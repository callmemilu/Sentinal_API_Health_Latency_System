import { NextResponse } from 'next/server';
// http://localhost:3000/api/mock-service
// In-memory toggle state for testing
let isHealthy = true;

export async function GET() {
  if (!isHealthy) {
    return NextResponse.json(
      { error: 'Internal Database Cluster Failure', code: 'DB_CONN_TIMEOUT' },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: 'ok', uptime: '99.9%' }, { status: 200 });
}

// POST toggles the health between 200 and 500
export async function POST() {
  isHealthy = !isHealthy;
  return NextResponse.json({
    message: `Mock service state toggled. Now returning: ${isHealthy ? '200 OK' : '500 Error'}`,
    isHealthy,
  });
}