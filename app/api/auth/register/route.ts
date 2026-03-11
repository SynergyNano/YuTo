import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const INVITE_CODE = process.env.INVITE_CODE ?? "yuto2026";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, inviteCode } = await req.json();

    // 초대코드 검증
    if (!inviteCode || inviteCode.trim() !== INVITE_CODE) {
      return NextResponse.json(
        { error: "초대코드가 올바르지 않습니다." },
        { status: 403 }
      );
    }

    // 필수 항목
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
    }
    if (name.trim().length > 20) {
      return NextResponse.json({ error: "이름은 20자 이하여야 합니다." }, { status: 400 });
    }

    if (!email || !email.trim()) {
      return NextResponse.json({ error: "이메일을 입력해주세요." }, { status: 400 });
    }
    if (email.length > 100) {
      return NextResponse.json({ error: "이메일은 100자 이하여야 합니다." }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
    }
    if (password.length > 100) {
      return NextResponse.json({ error: "비밀번호는 100자 이하여야 합니다." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: email.trim(),
        password: hashed,
        name: name.trim(),
        isActive: true,
      },
    });

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
