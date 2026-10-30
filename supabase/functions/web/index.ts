Deno.serve(async () => {
  const res = await fetch(
    'https://bkiqrhlthjodswqivdsn.supabase.co/storage/v1/object/public/web/index.html'
  )
  const html = await res.text()
  const headers = new Headers()
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', 'no-cache')
  return new Response(html, { headers })
})
