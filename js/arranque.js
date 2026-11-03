// Se carga antes que todo (sin módulo): marca que hay JavaScript y, por si el resto tarda o falla,
// muestra el titular igual a los 1,2 s. Va en un archivo aparte para que la CSP no tenga que permitir
// scripts en línea.
document.documentElement.classList.add('js');
setTimeout(function () {
  document.documentElement.classList.add('titular-listo');
}, 1200);
