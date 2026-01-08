// Récupération des boutons par leur ID
const btnAsso = document.getElementById("asso");
const btnBenevole = document.getElementById("benevole");

// Quand on clique sur "Association"
btnAsso.addEventListener("click", () => {
    window.location.href = "../tabord/tabord.html"; // redirige vers association.html
});

// Quand on clique sur "Bénévole"
btnBenevole.addEventListener("click", () => {
    window.location.href = "../benevoles/benevoles.html"; // redirige vers benevole.html
});
   