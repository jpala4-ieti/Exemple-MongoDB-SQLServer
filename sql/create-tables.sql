-- ============================================================================
-- Navision Game Database – Table Creation Script
-- Cooperative Platformer: API → SQL Server migration target
-- ============================================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'NavisionGameDB')
BEGIN
    CREATE DATABASE [NavisionGameDB];
END
GO

USE [NavisionGameDB];
GO

-- ─── 1. Player Categories ───────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PlayerCategory')
BEGIN
    CREATE TABLE [dbo].[PlayerCategory] (
        [Code]            NVARCHAR(10)   NOT NULL,
        [Name]            NVARCHAR(50)   NOT NULL,
        [MinGamesPlayed]  INT            NOT NULL DEFAULT 0,
        [CreatedAt]       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_PlayerCategory] PRIMARY KEY ([Code])
    );

    INSERT INTO [dbo].[PlayerCategory] ([Code], [Name], [MinGamesPlayed])
    VALUES
        ('JUN', 'Junior',  0),
        ('SEN', 'Senior',  10),
        ('EXP', 'Expert',  50);
END
GO

-- ─── 2. Players ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Player')
BEGIN
    CREATE TABLE [dbo].[Player] (
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

        CONSTRAINT [PK_Player]             PRIMARY KEY ([Id]),
        CONSTRAINT [UQ_Player_Nickname]    UNIQUE ([Nickname]),
        CONSTRAINT [FK_Player_Category]    FOREIGN KEY ([CategoryCode])
                                           REFERENCES [dbo].[PlayerCategory]([Code])
    );
END
GO

-- ─── 3. Games ────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Game')
BEGIN
    CREATE TABLE [dbo].[Game] (
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

        CONSTRAINT [PK_Game] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_Game_Status] CHECK (
            [Status] IN ('waiting','in_progress','completed','abandoned')
        )
    );
END
GO

-- ─── 4. Game–Player junction ────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'GamePlayer')
BEGIN
    CREATE TABLE [dbo].[GamePlayer] (
        [GameId]    INT           NOT NULL,
        [PlayerId]  INT           NOT NULL,
        [JoinedAt]  DATETIME2     NULL,

        CONSTRAINT [PK_GamePlayer]         PRIMARY KEY ([GameId], [PlayerId]),
        CONSTRAINT [FK_GamePlayer_Game]    FOREIGN KEY ([GameId])
                                           REFERENCES [dbo].[Game]([Id]),
        CONSTRAINT [FK_GamePlayer_Player]  FOREIGN KEY ([PlayerId])
                                           REFERENCES [dbo].[Player]([Id])
    );
END
GO

-- ─── 5. Movements ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Movement')
BEGIN
    CREATE TABLE [dbo].[Movement] (
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

        CONSTRAINT [PK_Movement]        PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Movement_Game]   FOREIGN KEY ([GameId])
                                        REFERENCES [dbo].[Game]([Id]),
        CONSTRAINT [FK_Movement_Player] FOREIGN KEY ([PlayerId])
                                        REFERENCES [dbo].[Player]([Id]),
        CONSTRAINT [CK_Movement_Action] CHECK (
            [Action] IN ('move_left','move_right','jump','pick_key','open_door')
        )
    );

    CREATE INDEX [IX_Movement_Game]   ON [dbo].[Movement] ([GameId]);
    CREATE INDEX [IX_Movement_Player] ON [dbo].[Movement] ([PlayerId]);
END
GO

-- ─── 6. Level Records ───────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LevelRecord')
BEGIN
    CREATE TABLE [dbo].[LevelRecord] (
        [Id]                     INT        IDENTITY(1,1) NOT NULL,
        [MongoId]                NVARCHAR(50) NULL,
        [GameId]                 INT          NOT NULL,
        [Level]                  INT          NOT NULL,
        [CompletionTimeSeconds]  FLOAT        NOT NULL,
        [CompletedAt]            DATETIME2    NOT NULL,
        [SyncedAt]               DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_LevelRecord]      PRIMARY KEY ([Id]),
        CONSTRAINT [FK_LevelRecord_Game] FOREIGN KEY ([GameId])
                                         REFERENCES [dbo].[Game]([Id])
    );
END
GO

-- ─── 7. Level Record – Players junction ─────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LevelRecordPlayer')
BEGIN
    CREATE TABLE [dbo].[LevelRecordPlayer] (
        [LevelRecordId]  INT   NOT NULL,
        [PlayerId]       INT   NOT NULL,

        CONSTRAINT [PK_LevelRecordPlayer]       PRIMARY KEY ([LevelRecordId], [PlayerId]),
        CONSTRAINT [FK_LRP_LevelRecord]         FOREIGN KEY ([LevelRecordId])
                                                REFERENCES [dbo].[LevelRecord]([Id]),
        CONSTRAINT [FK_LRP_Player]              FOREIGN KEY ([PlayerId])
                                                REFERENCES [dbo].[Player]([Id])
    );
END
GO

-- ============================================================================
-- VIEWS – ERP Indicators
-- ============================================================================

IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_LevelsCompletedByCategory')
    DROP VIEW [dbo].[vw_LevelsCompletedByCategory];
GO

CREATE VIEW [dbo].[vw_LevelsCompletedByCategory]
AS
SELECT
    pc.[Code]                       AS CategoryCode,
    pc.[Name]                       AS CategoryName,
    COUNT(DISTINCT p.[Id])          AS PlayerCount,
    SUM(p.[TotalLevelsCompleted])   AS TotalLevelsCompleted,
    AVG(CAST(p.[TotalLevelsCompleted] AS FLOAT)) AS AvgLevelsPerPlayer
FROM [dbo].[Player] p
INNER JOIN [dbo].[PlayerCategory] pc ON p.[CategoryCode] = pc.[Code]
GROUP BY pc.[Code], pc.[Name];
GO

IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_AvgTimePerLevel')
    DROP VIEW [dbo].[vw_AvgTimePerLevel];
GO

CREATE VIEW [dbo].[vw_AvgTimePerLevel]
AS
SELECT
    lr.[Level],
    COUNT(*)                                AS TimesCompleted,
    AVG(lr.[CompletionTimeSeconds])         AS AvgSeconds,
    MIN(lr.[CompletionTimeSeconds])         AS BestTimeSeconds,
    MAX(lr.[CompletionTimeSeconds])         AS WorstTimeSeconds
FROM [dbo].[LevelRecord] lr
GROUP BY lr.[Level];
GO

IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_PlayerRecords')
    DROP VIEW [dbo].[vw_PlayerRecords];
GO

CREATE VIEW [dbo].[vw_PlayerRecords]
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
FROM [dbo].[Player] p
INNER JOIN [dbo].[PlayerCategory] pc ON p.[CategoryCode] = pc.[Code]
OUTER APPLY (
    SELECT TOP 1
        lr.[CompletionTimeSeconds]  AS [BestTime],
        lr.[Level]                  AS [BestLevel]
    FROM [dbo].[LevelRecord] lr
    INNER JOIN [dbo].[LevelRecordPlayer] lrp ON lr.[Id] = lrp.[LevelRecordId]
    WHERE lrp.[PlayerId] = p.[Id]
    ORDER BY lr.[CompletionTimeSeconds] ASC
) bestLR;
GO

PRINT 'All tables, indexes, and indicator views created successfully.';
GO
