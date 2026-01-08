const API = "http://localhost:3000"; // ton backend Node/Neon
const select = document.getElementById("select-personne");
const localisationEl = document.getElementById("localisation");
const categories = ["megots", "plastique", "verre", "peche", "cannette"];
let benevoles = [];
let collectes = [];

// ⚡ Points par type de déchet
const pointsParType = {
  megots: 10,
  plastique: 30,
  verre: 20,
  peche: 15,
  cannette: 15
};

// 🟩 Charger les bénévoles et collectes depuis le serveur
async function loadData() {
  try {
    console.log("🔄 Chargement bénévoles et collectes...");
    const [resB, resC] = await Promise.all([
      fetch(`${API}/benevoles`),
      fetch(`${API}/collectes`)
    ]);

    benevoles = await resB.json();
    collectes = await resC.json();

    console.log("✅ Bénévoles :", benevoles);
    console.log("✅ Collectes :", collectes);

    remplirSelect();
  } catch (err) {
    console.error("Erreur chargement :", err);
    alert("Erreur de connexion au serveur.");
  }
}

// 🟦 Remplir le select avec les bénévoles
function remplirSelect() {
  select.innerHTML = "";
  benevoles.forEach(b => {
    const option = document.createElement("option");
    option.value = b.id;
    option.textContent = b.nom;
    select.appendChild(option);
  });

  if (benevoles.length > 0) {
    select.value = benevoles[0].id;
    afficherBenevole(benevoles[0].id);
  }
}

// 🟨 Quand on sélectionne un bénévole
select.addEventListener("change", () => {
  const id = select.value;
  afficherBenevole(id);
});

// 🟧 Afficher la localisation du bénévole
function afficherBenevole(id) {
  const b = benevoles.find(b => b.id == id);
  if (!b) return;

  localisationEl.textContent = `📍 Localisation : ${b.ville || "(inconnue)"}`;

  // 🧹 Réinitialiser les compteurs visuels à zéro
  for (const cat of categories) {
    document.getElementById(cat).innerText = '0';
  }
}

// 🟥 Changer un compteur (boutons + / -)
window.changerCompteur = function (id, valeur) {
  const compteur = document.getElementById(id);
  let n = parseInt(compteur.innerText);
  n = Math.max(0, n + valeur);
  compteur.innerText = n;
  
  // Animation de pulse
  compteur.classList.add('highlight');
  setTimeout(() => {
    compteur.classList.remove('highlight');
  }, 600);
};

// 🟪 Enregistrer la collecte (POST + PUT cumulatif avec points pondérés)
document.getElementById("registerBtn").addEventListener("click", async () => {
  const id_benevole = select.value;
  if (!id_benevole) return alert("Choisis un bénévole.");

  try {
    // 1️⃣ Récupérer le bénévole actuel depuis la base pour les totaux existants
    const resB = await fetch(`${API}/benevoles/${id_benevole}`);
    if (!resB.ok) throw new Error("Impossible de récupérer le bénévole");
    const benevole = await resB.json();

    let totalDechets = 0;
    let totalPoints = 0;

    // 🔁 POST chaque type de déchet
    for (const type of categories) {
      const quantite = parseInt(document.getElementById(type).innerText) || 0;
      if (quantite > 0) {
        const body = {
          id_benevole,
          type_dechet: type,
          quantite,
          points_dechet: quantite * (pointsParType[type] || 10)
        };

        const res = await fetch(`${API}/collectes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "<no body>");
          throw new Error(`POST échoué pour ${type}: ${txt}`);
        }

        totalDechets += quantite;
        totalPoints += quantite * (pointsParType[type] || 10);
      }
    }

    // 🔁 PUT pour mettre à jour le bénévole en cumulant avec les valeurs existantes
    const updateBody = {
      nbr_dechets: (benevole.nbr_dechets || 0) + totalDechets,
      nbr_points: (benevole.nbr_points || 0) + totalPoints
    };

    const res2 = await fetch(`${API}/benevoles/${id_benevole}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateBody)
    });

    if (!res2.ok) {
      const txt2 = await res2.text().catch(() => "<no body>");
      throw new Error(`PUT bénévole échoué: ${txt2}`);
    }

    // Afficher le badge de statut
    showStatusBadge("✅ Collecte ajoutée et bénévole mis à jour !");
    await loadData();
    afficherBenevole(id_benevole);
    resetCompteursVisuels();
  } catch (err) {
    console.error("❌ Erreur d'enregistrement :", err);
    alert("Erreur lors de l'enregistrement : " + err.message);
  }
});

// 🔁 Fonction pour remettre les compteurs à zéro dans l'interface
function resetCompteursVisuels() {
  for (const type of categories) {
    const el = document.getElementById(type);
    if (el) el.innerText = "0";
  }
}

// 🔸 Afficher le badge de statut
function showStatusBadge(message) {
  const badge = document.getElementById('statusBadge');
  if (badge) {
    badge.textContent = message;
    badge.classList.add('show');
    setTimeout(() => {
      badge.classList.remove('show');
    }, 3000);
  }
}

// 🚀 Lancer au chargement
window.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  resetCompteursVisuels();
});

// ⚡ Navigation
document.addEventListener('DOMContentLoaded', () => {
  const btnAccueil = document.getElementById('btn-accueil');
  const btnBenev = document.getElementById('btn-benev');

  if (btnAccueil) btnAccueil.addEventListener('click', () => { window.location.href = 'accueil.html'; });
  if (btnBenev) btnBenev.addEventListener('click', () => { window.location.href = 'benevdetail.html'; });
});