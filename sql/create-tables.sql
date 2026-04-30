-- ============================================================================
-- Navision Game Database – Table Creation Script
-- Cooperative Platformer: API → SQL Server migration target
-- PREFIX: XCOOP42_ to avoid collisions with existing data
-- NOTE: Database is already selected via the connection string (.env)
-- ============================================================================

-- ─── 1. Player Categories ───────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'XCOOP42_PlayerCategory')
BEGIN
    CREATE TABLE [dbo].[XCOOP42_PlayerCategory] (
        [Code]            NVARCHAR(10)   NOT NULL,
        [Name]            NVARCHAR(50)   NOT NULL,
        [MinGamesPlayed]  INT            NOT NULL DEFAULT 0,
        [CreatedAt]       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_XCOOP42_PlayerCategory] PRIMARY KEY ([Code])
    );

    INSERT INTO [dbo].[XCOOP42_PlayerCategory] ([Code], [Name], [MinGamesPlayed])
    VALUES
        ('JUN', 'Junior',  0),
        ('SEN', 'Senior',  10),
        ('EXP', 'Expert',  50);
END
GO

-- ─── 2. Players ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'XCOOP42_Player')
BEGIN
    CREATE TABLE [dbo].[XCOOP42_Player] (
        [Id]                    INT            IDENTITY(1,1) NOT NULL,
        [MongoId]               NVARCHAR(50)   NULL,
        [Nickname]              NVARCHAR(100)  NOT NULL,
        [CategoryCode]          NVARCHAR(10)   NOT NULL,
        [TotalGamesPlayed]      INT            NOT NULL DEFAULT 0,
        [TotalLevelsCompleted]  INT            NOT NULL DEFAULT 0,
        [TotalPlayTimeSeconds]  INT            NOT NULL DEFAULT 0,
        [CreatedAt]             DATETIME2      NOT NULL,
        [UpdatedAt]             DATETIME2      NULL,
        [SyncedAt]              DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_XCOOP42_Player]          PRIMARY KEY ([Id]),
        CONSTRAINT [UQ_XCOOP42_Player_Nickname] UNIQUE ([Nickname]),
        CONSTRAINT [FK_XCOOP42_Player_Category] FOREIGN KEY ([CategoryCode])
                                                REFERENCES [dbo].[XCOOP42_PlayerCategory]([Code])
    );
END
GO

-- ─── 3. Games ────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'XCOOP42_Game')
BEGIN
    CREATE TABLE [dbo].[XCOOP42_Game] (
        [Id]                    INT            IDENTITY(1,1) NOT NULL,
        [MongoId]               NVARCHAR(50)   NULL,
        [Status]                NVARCHAR(20)   NOT NULL,
        [PlayerCount]           INT            NOT NULL,
        [CurrentLevel]          INT            NULL,
        [LevelsCompleted]       INT            NOT NULL DEFAULT 0,
        [StartedAt]             DATETIME2      NOT NULL,
        [FinishedAt]            DATETIME2      NULL,
        [TotalDurationSeconds]  INT            NULL,
        [SyncedAt]              DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_XCOOP42_Game] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_XCOOP42_Game_Status] CHECK (
            [Status] IN ('waiting','in_progress','completed','abandoned')
        )
    );
END
GO

-- ─── 4. Game–Player junction ────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'XCOOP42_GamePlayer')
BEGIN
    CREATE TABLE [dbo].[XCOOP42_GamePlayer] (
        [GameId]    INT           NOT NULL,
        [PlayerId]  INT           NOT NULL,
        [JoinedAt]  DATETIME2     NULL,

        CONSTRAINT [PK_XCOOP42_GamePlayer]         PRIMARY KEY ([GameId], [PlayerId]),
        CONSTRAINT [FK_XCOOP42_GamePlayer_Game]    FOREIGN KEY ([GameId])
                                                   REFERENCES [dbo].[XCOOP42_Game]([Id]),
        CONSTRAINT [FK_XCOOP42_GamePlayer_Player]  FOREIGN KEY ([PlayerId])
                                                   REFERENCES [dbo].[XCOOP42_Player]([Id])
    );
END
GO

-- ─── 5. Movements ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'XCOOP42_Movement')
BEGIN
    CREATE TABLE [dbo].[XCOOP42_Movement] (
        [Id]          BIGINT         IDENTITY(1,1) NOT NULL,
        [MongoId]     NVARCHAR(50)   NULL,
        [GameId]      INT            NOT NULL,
        [PlayerId]    INT            NOT NULL,
        [Action]      NVARCHAR(20)   NOT NULL,
        [PositionX]   FLOAT          NULL,
        [PositionY]   FLOAT          NULL,
        [Level]       INT            NOT NULL DEFAULT 1,
        [Timestamp]   DATETIME2      NOT NULL,
        [SyncedAt]    DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_XCOOP42_Movement]        PRIMARY KEY ([Id]),
        CONSTRAINT [FK_XCOOP42_Movement_Game]   FOREIGN KEY ([GameId])
                                                REFERENCES [dbo].[XCOOP42_Game]([Id]),
        CONSTRAINT [FK_XCOOP42_Movement_Player] FOREIGN KEY ([PlayerId])
                                                REFERENCES [dbo].[XCOOP42_Player]([Id]),
        CONSTRAINT [CK_XCOOP42_Movement_Action] CHECK (
            [Action] IN ('move_left','move_right','jump','pick_key','open_door')
        )
    );

    CREATE INDEX [IX_XCOOP42_Movement_Game]   ON [dbo].[XCOOP42_Movement] ([GameId]);
    CREATE INDEX [IX_XCOOP42_Movement_Player] ON [dbo].[XCOOP42_Movement] ([PlayerId]);
END
GO

-- ─── 6. Level Records ───────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'XCOOP42_LevelRecord')
BEGIN
    CREATE TABLE [dbo].[XCOOP42_LevelRecord] (
        [Id]                     INT        IDENTITY(1,1) NOT NULL,
        [MongoId]                NVARCHAR(50) NULL,
        [GameId]                 INT          NOT NULL,
        [Level]                  INT          NOT NULL,
        [CompletionTimeSeconds]  FLOAT        NOT NULL,
        [CompletedAt]            DATETIME2    NOT NULL,
        [SyncedAt]               DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_XCOOP42_LevelRecord]      PRIMARY KEY ([Id]),
        CONSTRAINT [FK_XCOOP42_LevelRecord_Game] FOREIGN KEY ([GameId])
                                                 REFERENCES [dbo].[XCOOP42_Game]([Id])
    );
END
GO

-- ─── 7. Level Record – Players junction ─────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'XCOOP42_LevelRecordPlayer')
BEGIN
    CREATE TABLE [dbo].[XCOOP42_LevelRecordPlayer] (
        [LevelRecordId]  INT   NOT NULL,
        [PlayerId]       INT   NOT NULL,

        CONSTRAINT [PK_XCOOP42_LevelRecordPlayer] PRIMARY KEY ([LevelRecordId], [PlayerId]),
        CONSTRAINT [FK_XCOOP42_LRP_LevelRecord]   FOREIGN KEY ([LevelRecordId])
                                                   REFERENCES [dbo].[XCOOP42_LevelRecord]([Id]),
        CONSTRAINT [FK_XCOOP42_LRP_Player]         FOREIGN KEY ([PlayerId])
                                                   REFERENCES [dbo].[XCOOP42_Player]([Id])
    );
END
GO

-- ============================================================================
-- VIEWS – ERP Indicators
-- ============================================================================

IF EXISTS (SELECT * FROM sys.views WHERE name = 'XCOOP42_vw_LevelsCompletedByCategory')
    DROP VIEW [dbo].[XCOOP42_vw_LevelsCompletedByCategory];
GO

CREATE VIEW [dbo].[XCOOP42_vw_LevelsCompletedByCategory]
AS
SELECT
    pc.[Code]                       AS CategoryCode,
    pc.[Name]                       AS CategoryName,
    COUNT(DISTINCT p.[Id])          AS PlayerCount,
    SUM(p.[TotalLevelsCompleted])   AS TotalLevelsCompleted,
    AVG(CAST(p.[TotalLevelsCompleted] AS FLOAT)) AS AvgLevelsPerPlayer
FROM [dbo].[XCOOP42_Player] p
INNER JOIN [dbo].[XCOOP42_PlayerCategory] pc ON p.[CategoryCode] = pc.[Code]
GROUP BY pc.[Code], pc.[Name];
GO

IF EXISTS (SELECT * FROM sys.views WHERE name = 'XCOOP42_vw_AvgTimePerLevel')
    DROP VIEW [dbo].[XCOOP42_vw_AvgTimePerLevel];
GO

CREATE VIEW [dbo].[XCOOP42_vw_AvgTimePerLevel]
AS
SELECT
    lr.[Level],
    COUNT(*)                                AS TimesCompleted,
    AVG(lr.[CompletionTimeSeconds])         AS AvgSeconds,
    MIN(lr.[CompletionTimeSeconds])         AS BestTimeSeconds,
    MAX(lr.[CompletionTimeSeconds])         AS WorstTimeSeconds
FROM [dbo].[XCOOP42_LevelRecord] lr
GROUP BY lr.[Level];
GO

IF EXISTS (SELECT * FROM sys.views WHERE name = 'XCOOP42_vw_PlayerRecords')
    DROP VIEW [dbo].[XCOOP42_vw_PlayerRecords];
GO

CREATE VIEW [dbo].[XCOOP42_vw_PlayerRecords]
AS
SELECT
    p.[Nickname],
    pc.[Name]                       AS Category,
    p.[TotalGamesPlayed],
    p.[TotalLevelsCompleted],
    p.[TotalPlayTimeSeconds],
    CASE
        WHEN p.[TotalGamesPlayed] > 0
        THEN CAST(p.[TotalPlayTimeSeconds] AS FLOAT) / p.[TotalGamesPlayed]
        ELSE 0
    END                             AS AvgSecondsPerGame,
    bestLR.[BestTime]               AS PersonalBestSeconds,
    bestLR.[BestLevel]              AS PersonalBestLevel
FROM [dbo].[XCOOP42_Player] p
INNER JOIN [dbo].[XCOOP42_PlayerCategory] pc ON p.[CategoryCode] = pc.[Code]
OUTER APPLY (
    SELECT TOP 1
        lr.[CompletionTimeSeconds]  AS [BestTime],
        lr.[Level]                  AS [BestLevel]
    FROM [dbo].[XCOOP42_LevelRecord] lr
    INNER JOIN [dbo].[XCOOP42_LevelRecordPlayer] lrp ON lr.[Id] = lrp.[LevelRecordId]
    WHERE lrp.[PlayerId] = p.[Id]
    ORDER BY lr.[CompletionTimeSeconds] ASC
) bestLR;
GO

PRINT 'All XCOOP42_ tables, indexes, and indicator views created successfully.';
GO