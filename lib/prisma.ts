import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
    // Vercel Postgres requires pgbouncer=true for connection pooling
    let dbUrl = process.env.DATABASE_URL || "";
    if (dbUrl && !dbUrl.includes("pgbouncer=true")) {
        dbUrl += (dbUrl.includes("?") ? "&" : "?") + "pgbouncer=true&connection_limit=1";
    }
    prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } } as any);
} else {
    // Local development
    if (!(global as any).prisma) {
        (global as any).prisma = new PrismaClient();
    }
    prisma = (global as any).prisma;
}

export default prisma;
