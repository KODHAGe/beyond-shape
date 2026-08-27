/**
 * Thin Pages Function (spec §3.1 / CR-3 / CR-6): fixed JSON stub body.
 * Imports NOTHING from src/core — the SPA never requires this function.
 */

export const onRequest = async () => {
  return new Response(JSON.stringify({ ok: true, slice: 1, status: 'stub' }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};