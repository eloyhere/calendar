export interface Runnable {
    (): void;
}

export interface Supplier<R> {
    (): R;
}

export interface Consumer<T> {
    (t: T): void;
}

export interface BiConsumer<T, U> {
    (t: T, u: U): void;
}

export interface Functor<T, R> {
    (t: T): R;
}

export interface BiFunctor<T, U, R> {
    (t: T, u: U): R;
}
