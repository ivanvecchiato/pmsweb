SELECT f.insert_id, f.insert_time AS timestamp,
       f.id_prodotto AS productId, p.nome_prodotto AS productName,
       c.nome_categoria AS category, f.quantita_venduta AS quantity,
       CASE WHEN f.quantita_venduta = 0 THEN 0 ELSE f.importo_totale / f.quantita_venduta END AS price, f.id_cameriere AS operator,
       w.nome_cameriere AS operatorName, f.agent, f.chiusura,
       tv.nome_tavolo AS tableName,
       t.data_completa AS date, t.ora AS hour, t.fascia_oraria AS timeSlot,
       t.anno AS year, t.mese AS month, t.nome_mese AS monthName,
       t.giorno_del_mese AS day, t.giorno_della_settimana_num AS weekday,
       t.giorno_della_settimana_nome AS weekdayName,
       t.numero_settimana_anno AS week, t.data_inizio_settimana AS weekStart,
       t.is_weekend AS isWeekend
FROM Fatti_Ordini f
JOIN Dim_Prodotti p ON p.id_prodotto = f.id_prodotto
JOIN Dim_Categorie c ON c.id_categoria = p.id_categoria
JOIN Dim_Camerieri w ON w.id_cameriere = f.id_cameriere
JOIN Dim_Tavoli tv ON tv.id_tavolo = f.id_tavolo
JOIN Dim_Tempo t ON t.id_tempo = f.id_tempo
