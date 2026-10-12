import { isObject } from "../share/type";

//[start, end)
export interface Range {
    start: bigint;
    end: bigint;
}

export interface RawZone {
    id: string;
    offset: bigint; //时差，单位秒
    range: Range; //时差范围，单位秒
}

export class Zone {
    private raw: RawZone;

    public constructor(raw: RawZone) {
        if (isObject(raw)) {
            this.raw = raw;
        } else {
            throw new TypeError("Must be a raw zone.");
        }
        Object.freeze(this);
    }

    public getId(): string {
        return this.raw.id;
    }

    public getOffsetSeconds(): bigint {
        return this.raw.offset;
    }

    public getOffsetMinutes(): bigint {
        // bigint 的除法是向零取整，时差分钟数允许负数，语义正确
        return this.raw.offset / 60n;
    }

    public getOffsetHours(): bigint {
        return this.raw.offset / 3600n;
    }

    /** 把 `second` 从 `from` 时区换算到本时区：先回到 UTC，再加上本时区偏移。 */
    public offset(second: bigint, from: Zone): bigint {
        if (!(from instanceof Zone)) {
            throw new TypeError("from 必须是 Zone。");
        }
        return second - from.getOffsetSeconds() + this.raw.offset;
    }

    /** UTC 时区，偏移 0 秒，时差范围无界。 */
    public utc(): Zone {
        return new Zone({
            id: "UTC",
            offset: 0n,
            range: { start: -9223372036854775808n, end: 9223372036854775807n }
        });
    }
}
