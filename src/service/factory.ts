/// <reference types="vite/client" />
import type { Entity } from "../entity/entity";
import type { CrudService } from "./service";

/**
 * 组合根：store 层通过本模块按模块名解析 service，因此不依赖 repository 的构造参数，
 * 两层可以由不同的人并行实现。
 * 解析失败一律返回 null（不抛异常），由 store 保持空状态并给出中文错误信息。
 */

/** 模块名 → PascalCase：phase → Phase。 */
const pascal = (module: string): string => {
    return module
        .split("_")
        .filter((part: string): boolean => part.length > 0)
        .map((part: string): string => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
};

/**
 * 模块路径 → 惰性 loader。
 * 用 import.meta.glob 静态登记，构建期即可解析，不在运行期拼接模块路径；
 * 惰性求值：非 Vite 运行时调用会抛错，由 create 捕获后返回 null。
 */
let serviceLoaders: Record<string, () => Promise<unknown>> | undefined;
let repositoryLoaders: Record<string, () => Promise<unknown>> | undefined;

/** 取模块的 service loader；模块名不存在时返回 undefined。 */
const serviceLoader = (module: string): (() => Promise<unknown>) | undefined => {
    serviceLoaders ??= import.meta.glob("./*.service.ts") as Record<string, () => Promise<unknown>>;
    return serviceLoaders[`./${module}.service.ts`];
};

/** 取模块的 repository loader；模块名不存在时返回 undefined。 */
const repositoryLoader = (module: string): (() => Promise<unknown>) | undefined => {
    repositoryLoaders ??= import.meta.glob("../repository/*.repository.ts") as Record<
        string,
        () => Promise<unknown>
    >;
    return repositoryLoaders[`../repository/${module}.repository.ts`];
};

/** CrudService 的 12 个标准方法名，用于校验解析结果确实实现了服务端口。 */
const CrudMethods: Array<string> = [
    "count",
    "countBy",
    "exists",
    "existsBy",
    "list",
    "listByIdentities",
    "get",
    "find",
    "first",
    "one",
    "select",
    "selectBy"
];

/** 校验解析结果实现了 CrudService 的全部标准方法。 */
const isCrudService = (candidate: unknown): boolean => {
    if (typeof candidate !== "object" || candidate === null) {
        return false;
    }
    return CrudMethods.every(
        (method: string): boolean =>
            typeof (candidate as Record<string, unknown>)[method] === "function"
    );
};

/** 服务工厂：按模块名（entity 名，如 synodic、phase）解析 service 实例。 */
export interface ServiceFactory {
    /** 解析模块的 service；任何失败都返回 null。 */
    create(module: string): Promise<unknown | null>;
}

/**
 * 默认服务工厂。
 * 惰性加载该模块的 service 与 repository 模块，用零参构造 repository，
 * 再把同一个 repository 实例同时作为主表端口与年表端口注入 service
 * （repository 一个模块一个类，同时实现两张表）。
 * service 或 repository 缺失、构造抛错、端口不完整，一律返回 null。
 */
export const DEFAULT_SERVICE_FACTORY: ServiceFactory = {
    create: async (module: string): Promise<unknown | null> => {
        try {
            const loadService: (() => Promise<unknown>) | undefined = serviceLoader(module);
            const loadRepository: (() => Promise<unknown>) | undefined = repositoryLoader(module);
            if (loadService === undefined || loadRepository === undefined) {
                return null;
            }
            const services: Record<string, unknown> = (await loadService()) as Record<
                string,
                unknown
            >;
            const repositories: Record<string, unknown> = (await loadRepository()) as Record<
                string,
                unknown
            >;
            const name: string = pascal(module);
            const serviceClass: unknown = services[`${name}Service`];
            const repositoryClass: unknown = repositories[`${name}Repository`];
            if (typeof serviceClass !== "function" || typeof repositoryClass !== "function") {
                return null;
            }
            const repository: unknown = new (repositoryClass as new () => unknown)();
            const service: unknown = new (serviceClass as new (...args: Array<unknown>) => unknown)(
                repository,
                repository
            );
            return isCrudService(service) ? service : null;
        } catch {
            return null;
        }
    }
};

/** 按模块名解析 service，等价于 DEFAULT_SERVICE_FACTORY.create。 */
export const resolveService = async (module: string): Promise<unknown | null> => {
    return await DEFAULT_SERVICE_FACTORY.create(module);
};

/** 断言解析结果就是某个实体的 CrudService；校验失败返回 null。 */
export const asCrudService = <PK extends string | number | bigint, E extends Entity<PK>>(
    service: unknown
): CrudService<PK, E> | null => {
    return isCrudService(service) ? (service as CrudService<PK, E>) : null;
};
