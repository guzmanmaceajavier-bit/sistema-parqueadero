type PaginationOptions = {
  page?: number | string;
  limit?: number | string;
  where?: any;
  orderBy?: any;
  include?: any;
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
  { page = 1, limit, where = {}, orderBy = { id: "desc" }, include }: PaginationOptions = {},
): Promise<PaginationResult> {
  let resolvedLimit = limit;
  if (!resolvedLimit) {
    const config = await prisma.configuracion.findFirst();
    resolvedLimit = config?.paginacionPorDefecto || defaultLimit;
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(resolvedLimit)));
  const skip = (pageNum - 1) * limitNum;
  const delegate = prisma[model];

  const [data, total] = await Promise.all([
    delegate.findMany({ where, orderBy, skip, take: limitNum, include }),
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
