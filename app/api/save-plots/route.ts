import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const plots = await prisma.plot.findMany({
            orderBy: { plotNumber: 'asc' },
        });

        // Explicitly serialize Date objects to prevent hydration errors
        const serializedPlots = plots.map(plot => ({
            ...plot,
            createdAt: plot.createdAt.toISOString(),
            updatedAt: plot.updatedAt.toISOString(),
        }));

        return NextResponse.json(serializedPlots);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const plotsToSave = Array.isArray(body) ? body : [body];

        const results = await Promise.all(
            plotsToSave.map(async (plot) => {
                const { id, createdAt, updatedAt, ...plotData } = plot;

                return prisma.plot.upsert({
                    where: { signature: plotData.signature },
                    update: plotData,
                    create: plotData,
                });
            })
        );

        const serializedResults = results.map(plot => ({
            ...plot,
            createdAt: plot.createdAt.toISOString(),
            updatedAt: plot.updatedAt.toISOString(),
        }));

        return NextResponse.json(serializedResults);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: "No ID provided" }, { status: 400 });

        await prisma.plot.delete({
            where: { id: parseInt(id) }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
