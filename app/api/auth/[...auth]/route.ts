import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: { auth: string[] } }) {
  return await handleRequest(request, params);
}

export async function POST(request: Request, { params }: { params: { auth: string[] } }) {
  return await handleRequest(request, params);
}

async function handleRequest(request: Request, params: { auth: string[] }) {
  const path = params.auth.join('/');
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const url = `${backendUrl}/api/auth/${path}`;

  try {
    // [FIX] Handle empty POST bodies gracefully
    let body = undefined;
    if (request.method === 'POST') {
      const contentType = request.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          const text = await request.text();
          body = text ? JSON.parse(text) : undefined;
        } catch (e) {
          console.warn('Auth Proxy: Failed to parse JSON body or empty body');
          body = undefined;
        }
      }
    }

    const headers = new Headers(request.headers);
    // Ensure host header matches the backend to prevent SSRF protections from blocking us
    try {
      headers.set('host', new URL(backendUrl).host);
    } catch (e) {
      // Ignore if backendUrl is invalid
    }

    const response = await fetch(url, {
      method: request.method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // [FIX] Handle non-JSON responses from backend more robustly
    const responseText = await response.text();
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : { detail: 'Empty response from backend' };
    } catch (e) {
      responseData = { detail: responseText || 'Invalid JSON from backend' };
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    console.error('Auth Proxy Error:', error);
    return NextResponse.json({ detail: 'Internal server error in auth proxy' }, { status: 500 });
  }
}
