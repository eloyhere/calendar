export interface Entity<PK extends string | number | bigint> {
    identity: PK;
}
