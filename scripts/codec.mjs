// Codificação do bookmarklet: encodeURIComponent + ! ' ( ) * também escapados (%21 %27 %28 %29 %2A).
export function codificar(js) {
  return encodeURIComponent(js).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

export function decodificar(url) {
  return decodeURIComponent(url);
}
