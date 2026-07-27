import { NextResponse } from "next/server";

// Thrown by guards and business logic alike; caught once at the route-handler
// boundary (see toErrorResponse) so every endpoint gets consistent
// { error: string } JSON bodies and status codes without repeating try/catch
// boilerplate everywhere.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  // Never leak internal error details to the client for anything unexpected.
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
