import { isFunction, validate } from "../share/type";
import type { Consumer, Functor, Runnable, Supplier } from "./function";

export class Optional<T> {
    private value: T | null | undefined;

    private constructor(value?: T | null | undefined) {
        this.value = value;
    }

    /** 装载一个一定存在的值。 */
    public static of<T>(value: T): Optional<T> {
        if (!validate(value)) {
            throw new TypeError("Optional.of 不接受 null 与 undefined，请改用 Optional.empty。");
        }
        return new Optional<T>(value);
    }

    /** 空值，供 repository 在查无结果时返回。 */
    public static empty<T>(): Optional<T> {
        return new Optional<T>();
    }

    /** 允许空值的装载。 */
    public static ofNullable<T>(value?: T | null): Optional<T> {
        return validate(value) ? new Optional<T>(value) : new Optional<T>();
    }

    public get(): T;

    public get(other: T): T;

    public get(other?: T): T {
        if (other !== null && other !== void 0) {
            return this.isPresent() ? (this.value as T) : other;
        }
        if (this.isPresent()) {
            return this.value as T;
        }
        throw new TypeError("Optional is empty.");
    }

    public ifEmpty(callback: Runnable): void {
        if (this.isEmpty() && isFunction(callback)) {
            callback();
        }
    }

    public ifPresent(callback: Consumer<T>): void {
        if (this.isPresent() && isFunction(callback)) {
            callback(this.value as T);
        }
    }

    public isPresent(): boolean {
        return this.value !== null && this.value !== void 0;
    }

    public isEmpty(): boolean {
        return this.value === null || this.value === void 0;
    }

    public map(mapper: Functor<T, T>): Optional<T>;

    public map<R>(mapper: Functor<T, T>): Optional<R>;

    public map<R = T>(mapper: Functor<T, R>): Optional<R> {
        if (!isFunction(mapper)) {
            throw new TypeError("Mapper must be a function.");
        }
        return this.isPresent() ? new Optional<R>(mapper(this.value as T)) : new Optional<R>();
    }

    public orElse(other: T): T | void {
        return this.isPresent() ? (this.value as T) : other;
    }

    public orElseThrow<E extends Error>(callback: Supplier<E>): T {
        if (this.isEmpty()) {
            throw callback();
        }
        return this.value as T;
    }
}
