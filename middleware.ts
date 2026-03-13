import { auth } from "@/auth";

// NextAuth 미들웨어를 사용해 특정 경로를 보호
export const middleware = auth;

export const config = {
  matcher: [
    // 로그인/회원가입, 정적 리소스, API 등을 제외하고 모두 보호
    "/((?!api|_next/static|_next/image|favicon.ico|login|register).*)",
  ],
};

