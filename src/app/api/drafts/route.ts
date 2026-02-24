import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const dateStr = request.nextUrl.searchParams.get("date");
  if (!dateStr) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const date = new Date(dateStr + "T00:00:00.000Z");

  const draft = await prisma.draft.findUnique({
    where: { date },
  });

  return NextResponse.json({ draft: draft ?? null });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { date: dateStr, rawTranscript } = body;

  if (!dateStr) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const date = new Date(dateStr + "T00:00:00.000Z");

  // Empty transcript = delete the draft
  if (!rawTranscript || !rawTranscript.trim()) {
    await prisma.draft.deleteMany({ where: { date } });
    return NextResponse.json({ draft: null });
  }

  const draft = await prisma.draft.upsert({
    where: { date },
    create: { date, rawTranscript },
    update: { rawTranscript },
  });

  return NextResponse.json({ draft });
}

export async function DELETE(request: NextRequest) {
  const dateStr = request.nextUrl.searchParams.get("date");
  if (!dateStr) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const date = new Date(dateStr + "T00:00:00.000Z");
  await prisma.draft.deleteMany({ where: { date } });

  return NextResponse.json({ success: true });
}
