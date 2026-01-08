import express from "express";
import cors from "cors";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";


// Connexion à PostgreSQL
const db = neon(process.env.DATABASE_URL);
const app = express();
app.use(cors());
app.use(express.json()); 


// route
app.get("/", (req, res) => {
  res.send("Bienvenue sur l'API !");
});


//   Liste des bénévoles
app.get("/benevoles", async (req, res) => {
  try {
    const result = await db`SELECT * FROM benevoles`;
    console.log('GET /benevoles raw:', result);
    const rows = Array.isArray(result) ? result : (result && result.rows ? result.rows : []);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// Get a single benevole by name
// GET /benevoles/:param -> accept either numeric id or nom (string)
app.get('/benevoles/:param', async (req, res) => {
  const { param } = req.params;
  if (!param) return res.status(400).json({ error: 'Paramètre requis' });
  try {
    // if param is numeric, search by id
    const idNum = Number(param);
    let result;
    if (!Number.isNaN(idNum)) {
      result = await db`SELECT * FROM benevoles WHERE id = ${idNum}`;
    } else {
      result = await db`SELECT * FROM benevoles WHERE nom = ${param}`;
    }
    const rows = Array.isArray(result) ? result : (result.rows || []);
    if (rows.length === 0) return res.status(404).json({ error: 'Bénévole introuvable' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /benevoles/:param error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// Ajouter un nouveau bénévole
app.post("/benevoles", async (req, res) => {
  const { id, nom, prenom, nbr_points, nbr_dechets, ville } = req.body;
  if (!nom) return res.status(400).json({ error: "Le champ nom" });
  try {
    console.log(req.body);
    const result = await db.query(`
      INSERT INTO benevoles (id, nom, prenom, nbr_points,nbr_dechets,ville)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;`, [id, nom, prenom, nbr_points, nbr_dechets, ville]);
    console.log("Nouveau bénévole ajouté :", result[0]);
    res.status(201).json(result[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Impossible d'ajouter le benevole" });
  }
});


// Supprimer un bénévole par nom et prénom
app.delete("/benevoles", async (req, res) => {
  const { nom, prenom } = req.body; // récupération depuis le body

  if (!nom && !prenom) {
    return res.status(400).json({ error: "Nom et prénom sont requis" });
  }
  try {
    const result = await db`
      DELETE FROM benevoles
      WHERE nom = ${nom} AND prenom = ${prenom}
      RETURNING *;
    `;
    if (result.length > 0) {
      res.status(200).json({ message: "Bénévole supprimé", data: result });
    } else {
      res.status(404).json({ error: "Bénévole introuvable" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// Mettre à jour un bénévole par id
app.put("/benevoles/:id", async (req, res) => {
  const { id } = req.params; // récupérer l'id de l'URL
  const { nom, prenom, nbr_points, nbr_dechets, ville } = req.body;

  // Accept partial updates: at least one field should be provided
  if (nom == null && prenom == null && nbr_points == null && nbr_dechets == null && ville == null) {
    return res.status(400).json({ error: "Au moins un champ à mettre à jour est requis" });
  }

  try {
    const fields = [];
    const values = [];
    if (nom != null) { fields.push('nom'); values.push(nom); }
    if (prenom != null) { fields.push('prenom'); values.push(prenom); }
    if (nbr_points != null) { fields.push('nbr_points'); values.push(nbr_points); }
    if (nbr_dechets != null) { fields.push('nbr_dechets'); values.push(nbr_dechets); }
    if (ville != null) { fields.push('ville'); values.push(ville); }

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const queryParams = [...values, id];
    const sql = `UPDATE benevoles SET ${setClause} WHERE id = $${queryParams.length} RETURNING *;`;

    const result = await db.query(sql, queryParams);

    // normalize result
    let updated = null;
    if (!result) updated = null;
    else if (Array.isArray(result) && result.length > 0) updated = result[0];
    else if (result.rows && result.rows.length > 0) updated = result.rows[0];
    else if (result[0]) updated = result[0];

    if (!updated) return res.status(404).json({ error: 'Bénévole introuvable' });
    res.json(updated);
  } catch (err) {
    console.error('PUT /benevoles/:id error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Erreur mise à jour du bénévole', details: err && err.message ? err.message : String(err) });
  }
});



// Liste des collectes
app.get("/collectes", async (req, res) => {
  try {
    const result = await db`SELECT * FROM collectes`;
    console.log('GET /collectes raw:', result);
    const rows = Array.isArray(result) ? result : (result && result.rows ? result.rows : []);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }

});

app.post("/collectes", async (req, res) => {
  console.log("Body reçu (POST /collectes):", req.body);

  let { id_benevole, type_dechet, points_dechet, quantite, ville, date, nbr_pnt_type } = req.body;

  if (id_benevole == null || !type_dechet || quantite == null) {
    return res.status(400).json({ error: "Champs obligatoires: id_benevole, type_dechet, quantite" });
  }

  quantite = Number(quantite) || 0;
  points_dechet = (points_dechet == null) ? (quantite * 10) : Number(points_dechet);
  ville = ville || 'Inconnue';
  date = date || new Date().toISOString();
  nbr_pnt_type = (nbr_pnt_type == null) ? points_dechet : Number(nbr_pnt_type);

  try {
    // 1️⃣ Vérifier si une collecte existe déjà pour ce bénévole et ce type
    const existing = await db`
      SELECT * FROM collectes 
      WHERE id_benevole = ${id_benevole} AND type_dechet = ${type_dechet};
    `;

    let insertedOrUpdated;

    if (existing.length > 0) {
      // 2️⃣ Cumuler si existante
      const row = existing[0];
      const newQuantite = Number(row.quantite) + quantite;
      const newPoints = Number(row.points_dechet) + points_dechet;
      const newNbrPnt = Number(row.nbr_pnt_type) + points_dechet;

      const updateResult = await db`
        UPDATE collectes
        SET quantite = ${newQuantite}, 
            points_dechet = ${newPoints},
            nbr_pnt_type = ${newNbrPnt}
        WHERE id_benevole = ${id_benevole} AND type_dechet = ${type_dechet}
        RETURNING *;
      `;
      insertedOrUpdated = updateResult[0];
      console.log("Collecte cumulée :", insertedOrUpdated);
    } else {
      // 3️⃣ Créer une nouvelle ligne si inexistante
      const insertResult = await db`
        INSERT INTO collectes (id_benevole, type_dechet, points_dechet, quantite, ville, date, nbr_pnt_type)
        VALUES (${id_benevole}, ${type_dechet}, ${points_dechet}, ${quantite}, ${ville}, ${date}, ${nbr_pnt_type})
        RETURNING *;
      `;
      insertedOrUpdated = insertResult[0];
      console.log("Nouvelle collecte créée :", insertedOrUpdated);
    }

    res.status(201).json(insertedOrUpdated);

  } catch (err) {
    console.error("Erreur lors de l'insertion/cumul :", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Impossible d'ajouter ou cumuler", details: err && err.message ? err.message : String(err) });
  }
});

// Delete by id from URL param
app.delete('/collectes/:id', async (req, res) => {
  const id = req.params && req.params.id;
  if (!id) return res.status(400).json({ error: 'ID requis (url)' });

  const idNum = Number(id);
  const idToUse = Number.isNaN(idNum) ? id : idNum;

  console.log('DELETE /collectes/:id called with id:', idToUse);
  try {
    const result = await db`
      DELETE FROM collectes
      WHERE id = ${idToUse}
      RETURNING *;
    `;
    console.log('DELETE /collectes result raw:', result);

    let deleted;
    if (Array.isArray(result)) deleted = result;
    else if (result && result.rows) deleted = result.rows;
    else if (result && result[0]) deleted = [result[0]];
    else deleted = [];

    if (deleted.length > 0) {
      res.status(200).json({ message: 'Collecte supprimée', data: deleted });
    } else {
      res.status(404).json({ error: 'Collecte introuvable' });
    }
  } catch (err) {
    console.error('DELETE /collectes error', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Delete by id from JSON body
app.delete('/collectes', async (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: 'ID requis (body)' });

  const idNum = Number(id);
  const idToUse = Number.isNaN(idNum) ? id : idNum;

  console.log('DELETE /collectes (body) called with id:', idToUse);
  try {
    const result = await db`
      DELETE FROM collectes
      WHERE id = ${idToUse}
      RETURNING *;
    `;
    console.log('DELETE /collectes result raw:', result);

    let deleted;
    if (Array.isArray(result)) deleted = result;
    else if (result && result.rows) deleted = result.rows;
    else if (result && result[0]) deleted = [result[0]];
    else deleted = [];

    if (deleted.length > 0) {
      res.status(200).json({ message: 'Collecte supprimée', data: deleted });
    } else {
      res.status(404).json({ error: 'Collecte introuvable' });
    }
  } catch (err) {
    console.error('DELETE /collectes (body) error', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// Also accept PUT /collectes with id in JSON body (useful for tools that don't easily set URL params)
app.put('/collectes', async (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: 'ID requis dans le body' });

  const allowed = ['id_benevole','type_dechet','points_dechet','quantite','ville','date','nbr_pnt_type'];
  const fields = [];
  const values = [];
  for (const f of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, f) && req.body[f] != null) {
      fields.push(f);
      values.push(req.body[f]);
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: 'Au moins un champ à mettre à jour est requis' });

  try {
    const setClause = fields.map((f,i) => `${f} = $${i+1}`).join(', ');
    const queryParams = [...values, id];
    const sql = `UPDATE collectes SET ${setClause} WHERE id = $${queryParams.length} RETURNING *;`;
    console.log('PUT /collectes body sql:', sql, 'params:', queryParams);
    const result = await db.query(sql, queryParams);

    // normalize
    let updated = null;
    if (!result) updated = null;
    else if (Array.isArray(result) && result.length > 0) updated = result[0];
    else if (result.rows && result.rows.length > 0) updated = result.rows[0];
    else if (result[0]) updated = result[0];

    if (!updated) return res.status(404).json({ error: 'Collecte introuvable' });
    res.json(updated);
  } catch (err) {
    console.error('PUT /collectes (body) error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Erreur mise à jour de la collecte', details: err && err.message ? err.message : String(err) });
  }
});

// Also accept PUT /collectes/:id (id in URL param)
app.put('/collectes/:id', async (req, res) => {
  const idParam = req.params && req.params.id;
  if (!idParam) return res.status(400).json({ error: 'ID requis (url)' });

  const idNum = Number(idParam);
  const idToUse = Number.isNaN(idNum) ? idParam : idNum;

  const allowed = ['id_benevole','type_dechet','points_dechet','quantite','ville','date','nbr_pnt_type'];
  const fields = [];
  const values = [];
  for (const f of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, f) && req.body[f] != null) {
      fields.push(f);
      values.push(req.body[f]);
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: 'Au moins un champ à mettre à jour est requis' });

  try {
    const setClause = fields.map((f,i) => `${f} = $${i+1}`).join(', ');
    const queryParams = [...values, idToUse];
    const sql = `UPDATE collectes SET ${setClause} WHERE id = $${queryParams.length} RETURNING *;`;
    console.log('PUT /collectes/:id sql:', sql, 'params:', queryParams);
    const result = await db.query(sql, queryParams);

    let updated = null;
    if (!result) updated = null;
    else if (Array.isArray(result) && result.length > 0) updated = result[0];
    else if (result.rows && result.rows.length > 0) updated = result.rows[0];
    else if (result[0]) updated = result[0];

    if (!updated) return res.status(404).json({ error: 'Collecte introuvable' });
    console.log('PUT /collectes/:id updated:', updated);
    res.json(updated);
  } catch (err) {
    console.error('PUT /collectes/:id error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Erreur mise à jour de la collecte', details: err && err.message ? err.message : String(err) });
  }
});



// Liste des associations
app.get("/association", async (req, res) => {
  try {
    const result = await db`SELECT * FROM association`;
    console.log('GET /association raw:', result);
    const rows = Array.isArray(result) ? result : (result && result.rows ? result.rows : []);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }

  
});



//  Ajouter une nouvelle association
app.post("/association", async (req, res) => {

  const { nom, description, nbr_benevoles, argent } = req.body;

  if (!nom || !description) {
    return res.status(400).json({ error: "Nom et description sont requis" });
  }

  try {
    const result = await db`
      INSERT INTO association (nom, description, nbr_benevoles, argent)
      VALUES (${nom}, ${description}, ${nbr_benevoles || 0}, ${argent || 0})
      RETURNING *;
    `;
    console.log("Nouvelle association ajoutée :", result[0]);
    res.status(201).json(result[0]);
  } catch (err) {
    console.error("Erreur d'ajout :", err);
    res.status(500).json({ error: "Erreur lors de l'ajout de l'association" });
  }
});

app.delete("/association", async (req, res) => {
  const { nom } = req.body;
  if (!nom) return res.status(400).json({ error: "Nom requis" });

  try {
    // Delete from the association table (was incorrectly deleting from benevoles)
    const result = await db`
      DELETE FROM association
      WHERE nom = ${nom}
      RETURNING *;
    `;
    console.log('DELETE /association result:', result);

    // neon returns an array of rows for template queries; normalize to an array
    const deleted = Array.isArray(result) ? result : (result.rows || []);
    if (deleted.length > 0) {
      res.status(200).json({ message: "Association supprimée", data: deleted });
    } else {
      res.status(404).json({ error: "Association introuvable" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// Update an association with id in JSON body (PUT /association)
app.put('/association', async (req, res) => {
  const { id, nom, description, nbr_benevoles, argent } = req.body;
  if (!id) return res.status(400).json({ error: 'ID requis dans le body' });
  if (nom == null && description == null && nbr_benevoles == null && argent == null) {
    return res.status(400).json({ error: 'Au moins un champ à mettre à jour est requis' });
  }

  try {
    const fields = [];
    const values = [];
    if (nom != null) { fields.push('nom'); values.push(nom); }
    if (description != null) { fields.push('description'); values.push(description); }
    if (nbr_benevoles != null) { fields.push('nbr_benevoles'); values.push(nbr_benevoles); }
    if (argent != null) { fields.push('argent'); values.push(argent); }

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const queryParams = [...values, id];

    const sql = `UPDATE association SET ${setClause} WHERE id = $${queryParams.length} RETURNING *;`;
    const result = await db.query(sql, queryParams);
    const updated = result && result[0] ? result[0] : null;
    if (!updated) return res.status(404).json({ error: 'Association introuvable' });
    res.json(updated);
  } catch (err) {
    console.error('PUT /association (body) error', err);
    res.status(500).json({ error: "Erreur mise à jour de l'association" });
  }
});



const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`)
});