let defaultLimit = 20;
export async function setDefaultLimit(limit) { if (limit > 0) defaultLimit = limit; }

export async function paginate(prisma, model, { page = 1, limit, where = {}, orderBy = { id: "desc" }, include } = {}) {
  if (!limit) {
    const config = await prisma.configuracion.findFirst();
    limit = config?.paginacionPorDefecto || defaultLimit;
  }
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    prisma[model].findMany({ where, orderBy, skip, take: limitNum, include }),
    prisma[model].count({ where }),
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
