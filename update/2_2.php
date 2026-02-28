<?php

/**
 * Verifico se serve creare un conto per eventuali nuovi clienti o fornitori.
 */
$rs = $dbo->fetchArray('SELECT idanagrafica, ragione_sociale, (SELECT GROUP_CONCAT(an_tipianagrafiche.descrizione) FROM an_tipianagrafiche INNER JOIN an_tipianagrafiche_anagrafiche ON an_tipianagrafiche.idtipoanagrafica=an_tipianagrafiche_anagrafiche.idtipoanagrafica WHERE idanagrafica=an_anagrafiche.idanagrafica) AS idtipianagrafica FROM an_anagrafiche WHERE idconto_cliente=0 OR idconto_fornitore=0');

for ($i = 0; $i < sizeof($rs); ++$i) {
    if (in_array('Cliente', explode(',', (string) $rs[$i]['idtipianagrafica']))) {
        // Calcolo il codice conto più alto
        $rs2 = $dbo->fetchArray("SELECT MAX( CAST(numero AS UNSIGNED) ) AS max_numero, idpianodeiconti2 FROM co_pianodeiconti3 WHERE numero=CAST(numero AS UNSIGNED) AND idpianodeiconti2=(SELECT id FROM co_pianodeiconti2 WHERE descrizione='Crediti clienti e crediti diversi')");
        $numero = str_pad($rs2[0]['max_numero'] + 1, 6, '0', STR_PAD_LEFT);
        $idpianodeiconti2 = $rs2[0]['idpianodeiconti2'];

        // Creo il nuovo conto
        $dbo->query('INSERT INTO co_pianodeiconti3( numero, descrizione, idpianodeiconti2, can_delete, can_edit ) VALUES( '.prepare($numero).', '.prepare($rs[$i]['ragione_sociale']).', '.prepare($idpianodeiconti2).', 1, 1 )');
        $idconto = $dbo->lastInsertedID();

        // Collego questo conto al cliente
        $dbo->query('UPDATE an_anagrafiche SET idconto_cliente='.prepare($idconto).' WHERE idanagrafica='.prepare($rs[$i]['idanagrafica']));
    }

    if (in_array('Fornitore', explode(',', (string) $rs[$i]['idtipianagrafica']))) {
        // Calcolo il codice conto più alto
        $rs2 = $dbo->fetchArray("SELECT MAX( CAST(numero AS UNSIGNED) ) AS max_numero, idpianodeiconti2 FROM co_pianodeiconti3 WHERE numero=CAST(numero AS UNSIGNED) AND idpianodeiconti2=(SELECT id FROM co_pianodeiconti2 WHERE descrizione='Debiti fornitori e debiti diversi')");
        $numero = str_pad($rs2[0]['max_numero'] + 1, 6, '0', STR_PAD_LEFT);
        $idpianodeiconti2 = $rs2[0]['idpianodeiconti2'];

        // Creo il nuovo conto
        $dbo->query('INSERT INTO co_pianodeiconti3( numero, descrizione, idpianodeiconti2, can_delete, can_edit ) VALUES( '.prepare($numero).', '.prepare($rs[$i]['ragione_sociale']).', '.prepare($idpianodeiconti2).', 1, 1 )');
        $idconto = $dbo->lastInsertedID();

        // Collego questo conto al cliente
        $dbo->query('UPDATE an_anagrafiche SET idconto_fornitore='.prepare($idconto).' WHERE idanagrafica='.prepare($rs[$i]['idanagrafica']));
    }
}

// Sposto tutti i movimenti delle fatture dal riepilogativo (clienti o fornitori) al relativo conto di ogni anagrafica
$rs = $dbo->fetchArray('SELECT co_movimenti.id, co_documenti.idanagrafica, dir FROM (co_movimenti INNER JOIN co_documenti ON co_movimenti.iddocumento=co_documenti.id) INNER JOIN co_tipidocumento ON co_documenti.idtipodocumento WHERE NOT iddocumento=0');

for ($i = 0; $i < sizeof($rs); ++$i) {
    if ($rs[$i]['dir'] == 'entrata') {
        $query = 'UPDATE co_movimenti SET idconto=(SELECT idconto_cliente FROM an_anagrafiche WHERE idanagrafica='.prepare($rs[$i]['idanagrafica']).') WHERE id='.prepare($rs[$i]['id']).' AND idconto=(SELECT id FROM co_pianodeiconti3 WHERE descrizione="Riepilogativo clienti")';
    } else {
        $query = 'UPDATE co_movimenti SET idconto=(SELECT idconto_fornitore FROM an_anagrafiche WHERE idanagrafica='.prepare($rs[$i]['idanagrafica']).') WHERE id='.prepare($rs[$i]['id']).' AND idconto=(SELECT id FROM co_pianodeiconti3 WHERE descrizione="Riepilogativo fornitori")';
    }

    $dbo->query($query);
}
