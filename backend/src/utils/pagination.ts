type PaginationOptions = {
  page?: unknown;
  limit?: unknown;
  where?: any;
  orderBy?: any;
  include?: any;
  select?: any;
};

type PaginationResult<T = any> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

let defaultLimit = 20;

export async function setDefaultLimit(limit: number): Promise<void> {
  if (limit > 0) defaultLimit = limit;
}

export async function paginate(
  prisma: any,
  model: string,
  { page = 1, limit, where = {}, orderBy = { id: "desc" }, include, select }: PaginationOptions = {},
): Promise<PaginationResult> {
  let resolvedLimit = limit;
  if (!resolvedLimit) {
    const config = await prisma.configuracion.findFirst();
    resolvedLimit = config?.paginacionPorDefecto || defaultLimit;
  }

  const pageParsed = Number(page);
  const limitParsed = Number(resolvedLimit);
  const pageNum = Number.isFinite(pageParsed) ? Math.max(1, pageParsed) : 1;
  const limitNum = Number.isFinite(limitParsed)
    ? Math.min(100, Math.max(1, limitParsed))
    : defaultLimit;
  const skip = (pageNum - 1) * limitNum;
  const delegate = prisma[model];

  const [data, total] = await Promise.all([
    delegate.findMany({ where, orderBy, skip, take: limitNum, include, select }),
    delegate.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      hasMore: pageNum * limitNum < total,
    },
  };
}
