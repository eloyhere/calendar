export type MaybeNull<T> = T | null;
export type MaybeUndefined<T> = T | undefined;
export type MaybeInvalid<T> = T | undefined | null;
export const isBoolean: (target: unknown) => target is boolean = (
    target: unknown
): target is boolean => typeof target === "boolean";
export const isBigInt: (target: unknown) => target is bigint = (
    target: unknown
): target is bigint => typeof target === "bigint";
export const isNumber: (target: unknown) => target is number = (
    target: unknown
): target is number => typeof target === "number";
export const isSymbol: (target: unknown) => target is symbol = (
    target: unknown
): target is symbol => typeof target === "symbol";
export const isFunction: (target: unknown) => target is CallableFunction = (
    target: unknown
): target is CallableFunction => typeof target === "function";
export const isUndefined: (target: unknown) => target is undefined = (
    target: unknown
): target is undefined => typeof target === "undefined";
export const isObject: (target: unknown) => target is object = (
    target: unknown
): target is object => typeof target === "object" && target !== null;
export const validate: <T>(t: MaybeInvalid<T>) => t is T = <T>(t: MaybeInvalid<T>): t is T => {
    return t !== null && t !== void 0;
};
export const invalidate: <T>(t: MaybeInvalid<T>) => t is null | undefined = <T>(
    t: MaybeInvalid<T>
): t is null | undefined => {
    return t === null || t === void 0;
};
export type KeyOf<T> = keyof T;
export type ValueOf<T> = T[keyof T];
