import { err, ok, type Result } from "neverthrow";

interface IOption<T> {
  /** 判断当前 Option 是否为 Some。 */
  isSome(): this is Some<T>;

  /** 判断当前 Option 是否为 None。 */
  isNone(): this is None;

  /** 将 Some 中的值映射为新值，None 保持不变。 */
  map<U>(fn: (value: T) => U): Option<U>;

  /** 当值存在时执行函数，并把结果作为新的 Option。 */
  andThen<U>(fn: (value: T) => Option<U>): Option<U>;

  /** 当值存在时执行副作用，并原样返回当前 Option。 */
  andDo(fn: (value: T) => void): Option<T>;

  /** 当值缺失时执行副作用，并原样返回当前 Option。 */
  orDo(fn: () => void): Option<T>;

  /** 当值缺失时返回另一个 Option，否则返回自身。 */
  or<U>(other: Option<U>): Option<T | U>;

  /** 当值缺失时调用回退函数，否则返回自身。 */
  orElse<U>(fn: () => Option<U>): Option<T | U>;

  /** 返回 Some 中的值；值缺失时返回给定默认值。 */
  unwrapOr<U = undefined>(defaultValue?: U): T | U;

  /** 根据 Some 或 None 分支计算结果。 */
  match<U, V>(someFn: (value: T) => U, noneFn: () => V): U | V;

  /** 只保留满足条件的 Some。 */
  filter(predicate: (value: T) => boolean): Option<T>;

  /** 把 Some 转为 Ok，把 None 转为 Err。 */
  toResult(errorMessage?: string): Result<T, string>;
}

class Some<T> implements IOption<T> {
  constructor(private readonly value: T) {}

  isSome(): this is Some<T> {
    return true;
  }

  isNone(): this is None {
    return false;
  }

  map<U>(fn: (value: T) => U): Option<U> {
    return new Some(fn(this.value));
  }

  andThen<U>(fn: (value: T) => Option<U>): Option<U> {
    return fn(this.value);
  }

  or<U>(_other: Option<U>): Option<T | U> {
    return this;
  }

  orElse<U>(_fn: () => Option<U>): Option<T | U> {
    return this;
  }

  andDo(fn: (value: T) => void): Option<T> {
    fn(this.value);
    return this;
  }

  orDo(_fn: () => void): Option<T> {
    return this;
  }

  unwrapOr<U>(_defaultValue?: U): T {
    return this.value;
  }

  match<U, V>(someFn: (value: T) => U, _noneFn: () => V): U {
    return someFn(this.value);
  }

  filter(predicate: (value: T) => boolean): Option<T> {
    return predicate(this.value) ? this : none;
  }

  toResult(_errorMessage?: string): Result<T, string> {
    return ok(this.value);
  }
}

class None implements IOption<never> {
  private static readonly instance = new None();

  private constructor() {}

  static getInstance(): None {
    return None.instance;
  }

  isSome(): this is Some<never> {
    return false;
  }

  isNone(): this is None {
    return true;
  }

  map<U>(_fn: (value: never) => U): Option<U> {
    return none;
  }

  andThen<U>(_fn: (value: never) => Option<U>): Option<U> {
    return none;
  }

  or<U>(other: Option<U>): Option<U> {
    return other;
  }

  orElse<U>(fn: () => Option<U>): Option<U> {
    return fn();
  }

  andDo(_fn: (value: never) => void): Option<never> {
    return none;
  }

  orDo(fn: () => void): Option<never> {
    fn();
    return none;
  }

  unwrapOr<U>(defaultValue: U): U;
  unwrapOr(): undefined;
  unwrapOr<U>(defaultValue?: U): U | undefined {
    return defaultValue;
  }

  match<U, V>(_someFn: (value: never) => U, noneFn: () => V): U | V {
    return noneFn();
  }

  filter(_predicate: (value: never) => boolean): Option<never> {
    return none;
  }

  toResult(errorMessage?: string): Result<never, string> {
    return err(errorMessage ?? "None.toResult called on None");
  }
}

type Option<T> = Some<T> | None;

/** 创建一个 Some 实例。 */
function some<T>(value: T): Some<T> {
  return new Some(value);
}

/** None 的共享单例。 */
const none: None = None.getInstance();

/** 从可能为 null 或 undefined 的值创建 Option。 */
function fromNullable<T>(value: T | null | undefined): Option<T> {
  return value === null || value === undefined ? none : some(value);
}

export { fromNullable, none, some };
export type { IOption, None, Option, Some };
