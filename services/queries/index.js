/**
 * Busca colunas para o calculo da disponibilidade no sistema tubular.
 * @returns 
 */
exports.dis_tub_query = function () {
    return `
    SELECT 
        U.ID_USUARIO AS us_id,
        U.NOME AS us_nome,
        U.CPF_CNPJ AS us_cpf_cnpj,
        E.ID_EMPREENDIMENTO AS emp_id,
        E.ENDERECO AS emp_endereco,
        I.NUM_PROCESSO AS int_processo,
        I.ID_INTERFERENCIA AS int_id,
        I.NUM_ATO AS int_num_ato,
        I.LATITUDE AS int_latitude,
        I.LONGITUDE AS int_longitude,
        I.SHAPE AS int_shape,
        TI.ID_TIPO_INTERFERENCIA AS ti_id,
        TI.DESCRICAO AS ti_descricao,
        SP.ID_SITUACAO AS sp_id,
        SP.DESCRICAO AS sp_descricao,
        TP.ID_TIPO_POCO AS tp_id,
        TP.DESCRICAO AS tp_descricao,
        BH.OBJECTID_1 AS bh_id,
        BH.BACIA_NOME AS bh_nome,
        UH.OBJECTID AS uh_id,
        UH.UH_NOME AS uh_nome, /* codigo fraturado */ HF.[Cod_plan] AS geo_codigo,

        fin_finalidade =
        (SELECT
        (SELECT *
        FROM [SRH].[gisadmin].[FINALIDADE] fin
        JOIN [SRH].[gisadmin].[TIPO_FINALIDADE] AS tf ON tf.ID_TIPO_FINALIDADE = fin.ID_TIPO_FINALIDADE
        WHERE fin.ID_INTERFERENCIA = I.ID_INTERFERENCIA
        FOR XML PATH('FINALIDADES'),
        ROOT('ROOT'))),

        dt_demanda =
        (SELECT
        (SELECT *
        FROM [SRH].[gisadmin].[DEMANDA_TOTAL_SUB] AS DT
        WHERE DT.ID_INTERFERENCIA = I.ID_INTERFERENCIA
        FOR XML PATH('DEMANDAS'),
        ROOT('ROOT') ))
    FROM [SRH].[gisadmin].[SUBTERRANEA2] AS SUB
    LEFT JOIN [SRH].[gisadmin].[INTERFERENCIA] AS I ON SUB.[ID_INTERFERENCIA] = I.[ID_INTERFERENCIA]
    LEFT JOIN [SRH].[gisadmin].[EMPREENDIMENTO] AS E ON E.[ID_EMPREENDIMENTO] = I.[ID_EMPREENDIMENTO]
    LEFT JOIN [SRH].[gisadmin].[USUARIO] AS U ON U.[ID_USUARIO] = E.[ID_USUARIO]
    LEFT JOIN [SRH].[gisadmin].[TIPO_INTERFERENCIA] AS TI ON I.[ID_TIPO_INTERFERENCIA] = TI.[ID_TIPO_INTERFERENCIA]
    LEFT JOIN [SRH].[gisadmin].[SITUACAO_PROCESSO] AS SP ON I.[ID_SITUACAO] = SP.[ID_SITUACAO]
    LEFT JOIN [SRH].[gisadmin].[TIPO_POCO] AS TP ON SUB.[ID_TIPO_POCO] = TP.[ID_TIPO_POCO]
    LEFT JOIN [SRH].[gisadmin].[UNIDADES_HIDROGRAFICAS] AS UH ON I.[ID_UH] = UH.[OBJECTID] /* COMO VINCULAR BACIA COM UH -> ID_BACIA*/
    LEFT JOIN [SRH].[gisadmin].[BACIAS_HIDROGRAFICAS] AS BH ON UH.[ID_BACIA] = BH.[OBJECTID_1]
    JOIN [SRH].[gisadmin].[HIDROGEO_FRATURADO_UH] AS HF ON HF.Shape.STContains(I.SHAPE) = 1 /* CONDITION */
    WHERE SUB.[ID_TIPO_POCO] = 2 AND I.ID_INTERFERENCIA > 3000 AND I.ID_INTERFERENCIA < 3150
    `
}