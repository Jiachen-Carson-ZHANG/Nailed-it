export function GET(request: Request) {
  const url = new URL(request.url);
  const pinterestError = url.searchParams.get('error');

  if (pinterestError) {
    return Response.json(
      {
        ok: false,
        provider: 'pinterest',
        message: 'Pinterest returned an OAuth error. Full OAuth handling is not wired yet.',
        error: pinterestError
      },
      {
        status: 400
      }
    );
  }

  return Response.json({
    ok: true,
    provider: 'pinterest',
    message:
      'Pinterest OAuth callback endpoint is reserved for the upcoming read-only board and Pin import integration.'
  });
}
