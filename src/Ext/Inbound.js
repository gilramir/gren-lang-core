// Inbound's row on JavaScript (geng-lang m2-interop.md D419, §EI23.3). Nothing
// is checked on JavaScript, as D200 has it for every js row, so the term is
// the value. The row is here so that a program that imports `Inbound`, which
// `Dict` and `Set` do for their instances, still serves the js target.
function check(where, term) {
  return term;
}
