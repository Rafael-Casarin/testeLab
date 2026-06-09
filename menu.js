const menuButton = document.getElementById("menuButton");
const dropdownMenu = document.getElementById("dropdownMenu");

menuButton.addEventListener("click", function (event) {
  event.stopPropagation();
  dropdownMenu.classList.toggle("show");
});

document.addEventListener("click", function () {
  dropdownMenu.classList.remove("show");
});
