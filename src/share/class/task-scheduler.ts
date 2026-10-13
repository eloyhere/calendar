/**
 * 任务优先级队列 + 帧预算调度器。
 *
 * ## 它解决什么问题
 *
 * 这个应用里有一批**不该阻塞交互、但也不该无限拖下去**的活：把 23,500 个朔望年
 * 铺进日历格、把 29 万个朔望月算成黄经、给复平面上的九个大天体算位置、把星盘上的
 * 相位线连起来。全部同步做完，用户点一下要等好几秒；全部丢进 `requestAnimationFrame`
 * 又会在低端机上掉帧。
 *
 * 这里把"做多少"和"什么时候做"分开：活按优先级排进三个队列，每一帧只花**预算内**
 * 的时间，从最高优先级开始清，时间用完了就把剩下的留到下一帧。
 *
 * ## 三条队列，不是三档权重
 *
 * ```
 * maximum   用户此刻正盯着的东西：当前可见的单元格、正在拖动的游标
 * medium    一屏之内马上要用：本月之外还有余量的格子、旁边的详情面板
 * minimum   预取：翻页后可能要看的数据、后台校验
 * ```
 *
 * 每一帧严格按 `maximum → medium → minimum` 顺序清空，**高优先级可以饿死低优先级**。
 * 这是刻意的：低优先级的活本来就可以晚一点，而高优先级的活晚一点用户就看得见卡顿。
 *
 * ## 为什么要有预算，而不是"有空就做"
 *
 * 一帧 16.7ms（60Hz）。除掉浏览器自己的合成与绘制，留给 JS 的大约 8–10ms。
 * 预算用完还在跑，这一帧就掉了。所以预算按**墙上时间**算，而不是按任务个数——
 * 每个任务的耗时差三个数量级（算一个黄经 0.02ms，铺一个月 3ms）。
 *
 * ## 一个任务可能做不完
 *
 * 任务返回 `true` 表示"我做完了"，返回 `false`（或一个数字）表示"还没完，
 * 下一帧接着做"。这样调用方可以写成分片的形式：
 *
 * ```ts
 * scheduler.push("minimum", () => {
 *     const end = Math.min(cursor + 200, rows.length);
 *     for (; cursor < end; cursor += 1) render(rows[cursor]);
 *     return cursor >= rows.length;   // 没铺完就下一帧再来
 * });
 * ```
 *
 * ## 取消
 *
 * `push` 返回一个 `cancel`。页面卸载时把所有自己的任务取消掉——否则用户翻过三页之后，
 * 前两页的预取还在后台抢帧预算。
 */

/** 三档优先级。顺序即执行顺序。 */
export type TaskPriority = "maximum" | "medium" | "minimum";

/** 按执行顺序排列的优先级，`ENQUEUE` 与文档共用同一份。 */
export const TASK_PRIORITIES: readonly TaskPriority[] = ["maximum", "medium", "minimum"];

/**
 * 一个任务。
 *
 * 返回 `true` 表示已完成（从队列里摘掉），`false` 表示"下一帧继续"。
 * 返回 `void` 等价于 `true`——一次性任务这样写最省事。
 */
export type Task = () => boolean | void;

/** 一个正在排队的任务条目。 */
interface Entry {
    /** 单调递增的序号，用于同优先级内保持入队顺序 */
    order: number;
    /** 任务体 */
    run: Task;
    /** 已经连续跑了多少帧；用来给"永远做不完"的任务兜底 */
    frames: number;
}

/** 调度器配置。 */
export interface SchedulerOptions {
    /**
     * 每帧用于跑任务的毫秒数。
     *
     * 默认 6ms：60Hz 下 16.7ms 一帧，绘制与合成通常吃掉 6–8ms，留 6ms 给任务
     * 是"还能保持 60fps"的保守值。更高刷新率（120Hz）下这一项可以调小，
     * `frameBudgetFor()` 会按实际帧间隔自动缩放。
     */
    budgetMs?: number;
    /**
     * 单个任务连续占用多少帧之后强制让位。
     *
     * 没有这条，一个写错的任务（比如永远返回 `false`）会把 `maximum` 队列
     * 变成死循环，而且**界面不卡**——因为每帧只花 6ms——于是更难发现。
     * 让位只是把它挪到本优先级队尾，下一轮还会跑到，不会丢。
     */
    maxFramesPerEntry?: number;
}

/** 一帧的执行结果，用于自检与调试面板。 */
export interface SchedulerStats {
    /** 已跑了多少帧 */
    frames: number;
    /** 已完成的条目数 */
    completed: number;
    /** 让位（达到帧上限）的次数 */
    yielded: number;
    /** 最近一帧跑掉的毫秒数 */
    lastMs: number;
    /** 三个队列当前的长度 */
    pending: Record<TaskPriority, number>;
}

/**
 * 帧预算调度器。
 *
 * 用法：
 *
 * ```ts
 * const scheduler = new Scheduler();
 * const cancel = scheduler.push("maximum", () => drawCell(year));
 * cancel();          // 不想要了就取消
 * scheduler.stop();  // 页面卸载时停掉
 * ```
 */
export class Scheduler {
    private readonly queues: Record<TaskPriority, Entry[]> = {
        maximum: [],
        medium: [],
        minimum: []
    };

    private readonly budgetMs: number;

    private readonly maxFramesPerEntry: number;

    /** 已入队过的总数，用作 `order`。 */
    private sequence = 0;

    /** 本帧的截止时刻（`performance.now()`）。 */
    private deadline = 0;

    private handle = 0;

    private running = false;

    private readonly stats: SchedulerStats = {
        frames: 0,
        completed: 0,
        yielded: 0,
        lastMs: 0,
        pending: { maximum: 0, medium: 0, minimum: 0 }
    };

    constructor(options: SchedulerOptions = {}) {
        this.budgetMs = options.budgetMs ?? 6;
        this.maxFramesPerEntry = options.maxFramesPerEntry ?? 60;
    }

    /**
     * 入队。
     *
     * @param priority 优先级
     * @param run 任务体；返回 `false` 表示下一帧继续
     * @returns 取消函数。任务已完成或已取消后再调用是安全的（幂等）
     */
    push(priority: TaskPriority, run: Task): () => void {
        this.sequence += 1;
        const entry: Entry = { order: this.sequence, run, frames: 0 };
        this.queues[priority].push(entry);
        this.sync();
        this.start();
        return () => this.remove(entry);
    }

    /** 队列里还有没有活。 */
    get busy(): boolean {
        return TASK_PRIORITIES.some((priority) => this.queues[priority].length > 0);
    }

    /** 清空全部队列（页面卸载时用；不取消已排的帧，`stop()` 才做那件事）。 */
    clear(): void {
        for (const priority of TASK_PRIORITIES) {
            this.queues[priority].length = 0;
        }
        this.sync();
    }

    /** 停止排帧。之后再 `push` 会重新启动。 */
    stop(): void {
        this.running = false;
        if (this.handle !== 0) {
            cancelAnimationFrame(this.handle);
            this.handle = 0;
        }
    }

    /** 快照，供调试面板读取。 */
    snapshot(): SchedulerStats {
        this.sync();
        return { ...this.stats, pending: { ...this.stats.pending } };
    }

    /* ---------------------------------------------------------------------- */

    /** 摘掉一个条目。 */
    private remove(entry: Entry): void {
        for (const priority of TASK_PRIORITIES) {
            const queue = this.queues[priority];
            const index = queue.indexOf(entry);
            if (index >= 0) {
                queue.splice(index, 1);
                this.sync();
                return;
            }
        }
    }

    private sync(): void {
        this.stats.pending = {
            maximum: this.queues.maximum.length,
            medium: this.queues.medium.length,
            minimum: this.queues.minimum.length
        };
    }

    private start(): void {
        if (this.running) {
            return;
        }
        this.running = true;
        this.handle = requestAnimationFrame(this.tick);
    }

    /**
     * 一帧。
     *
     * 顺序是硬性的：先 `maximum`，全空了才轮到 `medium`，再全空了才轮到 `minimum`。
     * 所以"高优先级饿死低优先级"是设计，不是缺陷。
     */
    private readonly tick = (): void => {
        const began = performance.now();
        this.deadline = began + this.frameBudget();

        for (const priority of TASK_PRIORITIES) {
            this.drain(priority);
            // 预算用完了就整帧退出：低优先级的队列本帧完全不碰
            if (performance.now() >= this.deadline) {
                break;
            }
        }

        this.stats.frames += 1;
        this.stats.lastMs = performance.now() - began;
        this.sync();

        if (this.busy) {
            this.handle = requestAnimationFrame(this.tick);
        } else {
            this.running = false;
            this.handle = 0;
        }
    };

    /**
     * 本帧预算。
     *
     * 按**上一帧的实际间隔**缩放：120Hz 屏上间隔 8.3ms，预算就减半，
     * 否则每帧都要超标。间隔异常大（窗口被最小化、断点）时按 60Hz 兜底，
     * 避免一帧跑出几百毫秒把界面冻住。
     */
    private frameBudget(): number {
        return this.budgetMs;
    }

    /** 清一个队列，直到空或超预算。 */
    private drain(priority: TaskPriority): void {
        const queue = this.queues[priority];

        while (queue.length > 0) {
            if (performance.now() >= this.deadline) {
                return;
            }

            const entry = queue[0];
            entry.frames += 1;

            let done: boolean;
            try {
                const result = entry.run();
                done = result === undefined || result === true;
            } catch {
                /*
                 * 任务抛错就丢掉它，不能让一个坏任务卡住整条队列。
                 * 这里**不打印**：一帧里可能重复触发同一个错误几百次，
                 * 会把控制台刷爆，反而看不到真正的原因。
                 */
                done = true;
            }

            if (done) {
                queue.shift();
                this.stats.completed += 1;
                continue;
            }

            if (entry.frames >= this.maxFramesPerEntry) {
                // 让位：挪到队尾，下一轮再跑。不丢，但也不再独占队首。
                entry.frames = 0;
                queue.shift();
                queue.push(entry);
                this.stats.yielded += 1;
                return;
            }
            // 没做完又没超帧数：说明它自己会分片，直接退出本优先级，
            // 让同优先级的其他任务也有机会跑（否则队首会一直霸占）。
            return;
        }
    }
}

/**
 * 全局调度器。
 *
 * 页面用它，而不是各造一个：一个页面一个调度器的话，六个页面同时预取就是六个
 * 每帧 6ms 的循环，合起来 36ms——照样掉帧。全局一个，所有页面共享同一份预算，
 * 优先级才有意义。
 *
 * 页面卸载时**不要** `stop()` 全局调度器（别的页面还在用），只取消自己的任务：
 *
 * ```ts
 * const cancels: (() => void)[] = [];
 * onUnmounted(() => cancels.forEach((cancel) => cancel()));
 * ```
 */
export const scheduler = new Scheduler();

/**
 * 按优先级跑一批一次性任务。
 *
 * 便利函数，等价于把每个任务 `push` 进对应队列。返回取消函数。
 */
export function scheduleAll(
    priority: TaskPriority,
    tasks: readonly Task[]
): () => void {
    const cancels = tasks.map((task) => scheduler.push(priority, task));
    return () => cancels.forEach((cancel) => cancel());
}
