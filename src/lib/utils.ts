import { NextRequest } from "next/server";

export function getUserId(request: NextRequest): number {
  return parseInt(request.headers.get("x-user-id") || "0", 10);
}
