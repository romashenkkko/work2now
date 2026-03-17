export type PrismaFindManyDelegate<T> = {
  findMany: () => Promise<T[]>;
};

export async function findAllAs<TRecord, TModel>(
  delegate: PrismaFindManyDelegate<TRecord>,
  factory: (row: TRecord) => TModel
): Promise<TModel[]> {
  const rows = await delegate.findMany();
  return rows.map(factory);
}

