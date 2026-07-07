-- ============================================================
--  HAL映画館 予約管理システム  PostgreSQL DDL
-- ============================================================

-- ============================================================
--  1. 会員テーブル  t_MEMBER
-- ============================================================
CREATE TABLE t_MEMBER (
    f_member_id   SERIAL        PRIMARY KEY,
    f_last_name   VARCHAR(50)   NOT NULL,
    f_first_name  VARCHAR(50)   NOT NULL,
    f_email       VARCHAR(255)  NOT NULL,
    f_password    VARCHAR(255)  NOT NULL,
    f_created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_member_email UNIQUE (f_email)
);

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.f_updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_member_updated_at
    BEFORE UPDATE ON t_MEMBER
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE INDEX idx_member_name ON t_MEMBER (f_last_name, f_first_name);

-- ============================================================
--  2. 映画テーブル  t_MOVIE
-- ============================================================
CREATE TABLE t_MOVIE (
    f_movie_id      SERIAL       PRIMARY KEY,
    f_title         VARCHAR(200) NOT NULL,
    f_title_en      VARCHAR(200),
    f_genre         VARCHAR(50)  NOT NULL,
    f_duration      SMALLINT,
    f_rating        VARCHAR(10)  NOT NULL,
    f_release_date  DATE         NOT NULL,
    f_director      VARCHAR(100),
    f_cast_info     VARCHAR(300),
    f_synopsis      TEXT,
    f_formats       VARCHAR(100),
    f_is_showing    SMALLINT     NOT NULL DEFAULT 1
        CHECK (f_is_showing IN (0, 1))
);

CREATE INDEX idx_movie_is_showing   ON t_MOVIE (f_is_showing);
CREATE INDEX idx_movie_release_date ON t_MOVIE (f_release_date);

-- ============================================================
--  3. スクリーンテーブル  t_SCREEN
-- ============================================================
CREATE TABLE t_SCREEN (
    f_screen_id    SERIAL      PRIMARY KEY,
    f_screen_name  VARCHAR(50) NOT NULL,
    f_screen_type  VARCHAR(20) NOT NULL,
    f_seat_count   SMALLINT    NOT NULL
);

CREATE INDEX idx_screen_type ON t_SCREEN (f_screen_type);

-- ============================================================
--  4. 座席テーブル  t_SEAT
-- ============================================================
CREATE TABLE t_SEAT (
    f_seat_id      SERIAL      PRIMARY KEY,
    f_screen_id    INTEGER     NOT NULL REFERENCES t_SCREEN (f_screen_id),
    f_row_label    VARCHAR(5)  NOT NULL,
    f_seat_number  SMALLINT    NOT NULL,
    f_seat_type    VARCHAR(20) NOT NULL DEFAULT '一般',

    CONSTRAINT uq_seat_position UNIQUE (f_screen_id, f_row_label, f_seat_number)
);

CREATE INDEX idx_seat_screen_id ON t_SEAT (f_screen_id);

-- ============================================================
--  5. 上映スケジュールテーブル  t_SCHEDULE
-- ============================================================
CREATE TABLE t_SCHEDULE (
    f_schedule_id  SERIAL   PRIMARY KEY,
    f_movie_id     INTEGER  NOT NULL REFERENCES t_MOVIE  (f_movie_id),
    f_screen_id    INTEGER  NOT NULL REFERENCES t_SCREEN (f_screen_id),
    f_show_date    DATE     NOT NULL,
    f_start_time   TIME     NOT NULL,
    f_status       SMALLINT NOT NULL DEFAULT 0
        CHECK (f_status IN (0, 1, 2)),

    CONSTRAINT uq_schedule UNIQUE (f_screen_id, f_show_date, f_start_time)
);

CREATE INDEX idx_schedule_show_date  ON t_SCHEDULE (f_show_date);
CREATE INDEX idx_schedule_movie_id   ON t_SCHEDULE (f_movie_id);
CREATE INDEX idx_schedule_screen_id  ON t_SCHEDULE (f_screen_id);

-- ============================================================
--  6. 料金区分テーブル  t_PRICE_CATEGORY
-- ============================================================
CREATE TABLE t_PRICE_CATEGORY (
    f_price_category_id  SERIAL      PRIMARY KEY,
    f_category_name      VARCHAR(50) NOT NULL
);

-- ============================================================
--  7. 上映料金テーブル  t_SCREEN_PRICE
-- ============================================================
CREATE TABLE t_SCREEN_PRICE (
    f_price_id           SERIAL   PRIMARY KEY,
    f_schedule_id        INTEGER  NOT NULL REFERENCES t_SCHEDULE       (f_schedule_id),
    f_price_category_id  INTEGER  NOT NULL REFERENCES t_PRICE_CATEGORY (f_price_category_id),
    f_price              INTEGER  NOT NULL,

    CONSTRAINT uq_screen_price UNIQUE (f_schedule_id, f_price_category_id)
);

CREATE INDEX idx_screen_price_schedule ON t_SCREEN_PRICE (f_schedule_id);

-- ============================================================
--  8. 予約テーブル  t_RESERVATION
-- ============================================================
CREATE TABLE t_RESERVATION (
    f_reservation_id      SERIAL       PRIMARY KEY,
    f_member_id           INTEGER               REFERENCES t_MEMBER   (f_member_id),
    f_schedule_id         INTEGER      NOT NULL  REFERENCES t_SCHEDULE (f_schedule_id),
    f_reserved_at         TIMESTAMP    NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    f_reservation_code    VARCHAR(20)  NOT NULL,
    f_total_amount        INTEGER      NOT NULL,
    f_payment_method      SMALLINT     NOT NULL
        CHECK (f_payment_method IN (1, 2, 3)),
    f_payment_status      SMALLINT     NOT NULL  DEFAULT 0
        CHECK (f_payment_status IN (0, 1, 2)),
    f_reservation_status  SMALLINT     NOT NULL  DEFAULT 0
        CHECK (f_reservation_status IN (0, 1, 2)),

    CONSTRAINT uq_reservation_code UNIQUE (f_reservation_code)
);

CREATE INDEX idx_reservation_member_id   ON t_RESERVATION (f_member_id);
CREATE INDEX idx_reservation_schedule_id ON t_RESERVATION (f_schedule_id);
CREATE INDEX idx_reservation_reserved_at ON t_RESERVATION (f_reserved_at);

-- ============================================================
--  9. 予約明細テーブル  t_RESERVATION_DETAIL
-- ============================================================
CREATE TABLE t_RESERVATION_DETAIL (
    f_detail_id          SERIAL   PRIMARY KEY,
    f_reservation_id     INTEGER  NOT NULL REFERENCES t_RESERVATION    (f_reservation_id),
    f_seat_id            INTEGER  NOT NULL REFERENCES t_SEAT           (f_seat_id),
    f_price_category_id  INTEGER  NOT NULL REFERENCES t_PRICE_CATEGORY (f_price_category_id),
    f_ticket_price       INTEGER  NOT NULL,

    CONSTRAINT uq_detail_seat UNIQUE (f_reservation_id, f_seat_id)
);

CREATE INDEX idx_detail_reservation_id ON t_RESERVATION_DETAIL (f_reservation_id);
CREATE INDEX idx_detail_seat_id        ON t_RESERVATION_DETAIL (f_seat_id);

-- ============================================================
--  10. チケットテーブル  t_TICKET
-- ============================================================
CREATE TABLE t_TICKET (
    f_ticket_id     SERIAL        PRIMARY KEY,
    f_detail_id     INTEGER       NOT NULL REFERENCES t_RESERVATION_DETAIL (f_detail_id),
    f_qr_code       VARCHAR(500)  NOT NULL,
    f_ticket_status SMALLINT      NOT NULL  DEFAULT 0
        CHECK (f_ticket_status IN (0, 1, 2, 3)),
    f_issued_at     TIMESTAMP,
    f_used_at       TIMESTAMP,

    CONSTRAINT uq_ticket_detail  UNIQUE (f_detail_id),
    CONSTRAINT uq_ticket_qr_code UNIQUE (f_qr_code)
);

CREATE INDEX idx_ticket_status ON t_TICKET (f_ticket_status);

-- ============================================================
--  11. 座席在庫テーブル  t_SEAT_STOCK
-- ============================================================
CREATE TABLE t_SEAT_STOCK (
    f_stock_id      SERIAL   PRIMARY KEY,
    f_schedule_id   INTEGER  NOT NULL REFERENCES t_SCHEDULE (f_schedule_id),
    f_seat_id       INTEGER  NOT NULL REFERENCES t_SEAT     (f_seat_id),
    f_stock_status  SMALLINT NOT NULL DEFAULT 0
        CHECK (f_stock_status IN (0, 1, 2)),

    CONSTRAINT uq_seat_stock UNIQUE (f_schedule_id, f_seat_id)
);

CREATE INDEX idx_seat_stock_schedule_status ON t_SEAT_STOCK (f_schedule_id, f_stock_status);

-- ============================================================
--  12. 上映ステータスマスターテーブル  t_SCHEDULE_STATUS
-- ============================================================
CREATE TABLE t_SCHEDULE_STATUS (
    f_status_id    SMALLINT     PRIMARY KEY,
    f_status_name  VARCHAR(50)  NOT NULL,
    f_description  VARCHAR(200)
);

-- ============================================================
--  13. 映画画像テーブル  t_MOVIE_IMAGE
-- ============================================================
CREATE TABLE t_MOVIE_IMAGE (
    f_image_id       SERIAL        PRIMARY KEY,
    f_movie_id       INTEGER       NOT NULL REFERENCES t_MOVIE (f_movie_id) ON DELETE CASCADE,
    f_image_type     VARCHAR(20)   NOT NULL DEFAULT 'poster'
        CHECK (f_image_type IN ('poster', 'banner', 'still', 'thumbnail')),
    f_image_url      VARCHAR(500)  NOT NULL,
    f_alt_text       VARCHAR(200),
    f_display_order  SMALLINT      NOT NULL DEFAULT 0,
    f_created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_movie_image_movie_id   ON t_MOVIE_IMAGE (f_movie_id);
CREATE INDEX idx_movie_image_type       ON t_MOVIE_IMAGE (f_image_type);

-- t_MOVIE にメイン画像IDカラムを追加（t_MOVIE_IMAGE 作成後に追加）
ALTER TABLE t_MOVIE ADD COLUMN f_image_id INTEGER REFERENCES t_MOVIE_IMAGE (f_image_id);

-- ============================================================
--  14. グッズ・商品テーブル  t_GOODS
-- ============================================================
CREATE TABLE t_GOODS (
    f_goods_id    SERIAL        PRIMARY KEY,
    f_goods_name  VARCHAR(200)  NOT NULL,
    f_goods_type  VARCHAR(50)   NOT NULL DEFAULT '一般'
        CHECK (f_goods_type IN ('フード', 'ドリンク', 'グッズ', '一般')),
    f_price       INTEGER       NOT NULL,
    f_stock       INTEGER       NOT NULL DEFAULT 0,
    f_is_active   SMALLINT      NOT NULL DEFAULT 1
        CHECK (f_is_active IN (0, 1)),
    f_created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_goods_type      ON t_GOODS (f_goods_type);
CREATE INDEX idx_goods_is_active ON t_GOODS (f_is_active);

-- ============================================================
--  15. グッズ画像テーブル  t_GOODS_IMAGE
-- ============================================================
CREATE TABLE t_GOODS_IMAGE (
    f_image_id       SERIAL        PRIMARY KEY,
    f_goods_id       INTEGER       NOT NULL REFERENCES t_GOODS (f_goods_id) ON DELETE CASCADE,
    f_image_type     VARCHAR(20)   NOT NULL DEFAULT 'main'
        CHECK (f_image_type IN ('main', 'thumbnail', 'detail')),
    f_image_url      VARCHAR(500)  NOT NULL,
    f_alt_text       VARCHAR(200),
    f_display_order  SMALLINT      NOT NULL DEFAULT 0,
    f_created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_goods_image_goods_id ON t_GOODS_IMAGE (f_goods_id);

-- ============================================================
--  16. 会員クレジットカードテーブル  t_MEMBER_CARD
--  ※ PCI DSS準拠：カード番号本体・CVVは保存しない。
--     表示用の下4桁とブランド・有効期限・名義のみ保持する。
-- ============================================================
CREATE TABLE t_MEMBER_CARD (
    f_card_id       SERIAL        PRIMARY KEY,
    f_member_id     INTEGER       NOT NULL REFERENCES t_MEMBER (f_member_id) ON DELETE CASCADE,
    f_card_holder   VARCHAR(100)  NOT NULL,
    f_card_brand    VARCHAR(20)   NOT NULL DEFAULT 'その他',
    f_card_last4    VARCHAR(4)    NOT NULL,
    f_expire_month  SMALLINT      NOT NULL CHECK (f_expire_month BETWEEN 1 AND 12),
    f_expire_year   SMALLINT      NOT NULL,
    f_is_default    SMALLINT      NOT NULL DEFAULT 0 CHECK (f_is_default IN (0, 1)),
    f_created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_member_card UNIQUE (f_member_id, f_card_last4, f_expire_month, f_expire_year)
);

CREATE INDEX idx_member_card_member_id ON t_MEMBER_CARD (f_member_id);

-- ============================================================
--  初期データ（上映ステータスマスタ）
-- ============================================================
INSERT INTO t_SCHEDULE_STATUS (f_status_id, f_status_name, f_description) VALUES
    (0, '上映予定', '公開・予約受付前'),
    (1, '上映中',   '現在上映・予約受付中'),
    (2, '上映終了', '上映完了・予約不可');

-- ============================================================
--  初期データ（料金区分マスタ）
-- ============================================================
INSERT INTO t_PRICE_CATEGORY (f_category_name) VALUES
    ('一般'),
    ('学生'),
    ('シニア');

-- ============================================================
--  シードデータ（スクリーン）
-- ============================================================
INSERT INTO t_SCREEN (f_screen_name, f_screen_type, f_seat_count) VALUES
    ('SC1', 'large',  200),
    ('SC2', 'large',  200),
    ('SC3', 'medium', 120),
    ('SC4', 'small',   70);

-- ============================================================
--  シードデータ（座席）
--  SC1/SC2: rows A-M × 14cols + row N × 18cols
--  SC3:     rows A-J × 12cols
--  SC4:     rows A-G × 10cols
-- ============================================================
DO $$
DECLARE
    screen_id   INT;
    row_labels  TEXT[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N'];
    r           TEXT;
    c           INT;
BEGIN
    -- SC1, SC2 (large)
    FOR screen_id IN (SELECT f_screen_id FROM t_screen WHERE f_screen_type = 'large') LOOP
        FOREACH r IN ARRAY row_labels LOOP
            IF r = 'N' THEN
                FOR c IN 1..18 LOOP
                    INSERT INTO t_SEAT (f_screen_id, f_row_label, f_seat_number) VALUES (screen_id, r, c);
                END LOOP;
            ELSE
                FOR c IN 1..14 LOOP
                    INSERT INTO t_SEAT (f_screen_id, f_row_label, f_seat_number) VALUES (screen_id, r, c);
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;

    -- SC3 (medium): rows A-J × 12cols
    FOR screen_id IN (SELECT f_screen_id FROM t_screen WHERE f_screen_type = 'medium') LOOP
        FOR i IN 1..10 LOOP
            r := row_labels[i];
            FOR c IN 1..12 LOOP
                INSERT INTO t_SEAT (f_screen_id, f_row_label, f_seat_number) VALUES (screen_id, r, c);
            END LOOP;
        END LOOP;
    END LOOP;

    -- SC4 (small): rows A-G × 10cols
    FOR screen_id IN (SELECT f_screen_id FROM t_screen WHERE f_screen_type = 'small') LOOP
        FOR i IN 1..7 LOOP
            r := row_labels[i];
            FOR c IN 1..10 LOOP
                INSERT INTO t_SEAT (f_screen_id, f_row_label, f_seat_number) VALUES (screen_id, r, c);
            END LOOP;
        END LOOP;
    END LOOP;
END$$;

-- ============================================================
--  シードデータ（映画）
--  ※ もともと data/movies.json にあった映画データをDBに移行したもの
-- ============================================================
INSERT INTO t_MOVIE
    (f_title, f_title_en, f_genre, f_duration, f_rating, f_release_date,
     f_director, f_cast_info, f_synopsis, f_formats, f_is_showing)
VALUES
    ('ゴジラ-1.0', 'GODZILLA MINUS ONE', 'アクション / SF', 125, 'G', '2026-05-01',
        '山崎 貴', '神木隆之介、浜辺美波、山田裕貴',
        '戦後日本を舞台に、突如現れた巨大怪獣ゴジラが壊滅的な破壊をもたらす。何もかも失った人々が、絶望の中でゴジラに立ち向かう姿を描いた超大作。',
        '字幕,吹替', 1),

    ('名探偵コナン 黒鉄の魚影', 'DETECTIVE CONAN: BLACK IRON SUBMARINE', 'アニメ / ミステリー', 113, 'G', '2026-05-08',
        '立川譲', '高山みなみ、山崎和佳奈、神谷明',
        '世界各国の警察データを管理する巨大海上施設「パシフィック・ブイ」を舞台に、コナンが国際組織の陰謀に挑む。',
        '字幕', 1),

    ('THE FIRST SLAM DUNK', 'THE FIRST SLAM DUNK', 'アニメ / スポーツ', 124, 'G', '2026-05-15',
        '井上雄彦', '仲村宗悟、笠間淳、木村昴',
        'バスケットボールに青春を賭けた湘北高校の5人が、全国制覇を目指す姿を圧倒的な映像と音楽で描く完全新作劇場版。',
        '字幕なし', 1),

    ('スパイダーマン:アクロス', 'SPIDER-MAN: ACROSS THE SPIDER-VERSE', 'アクション / SF', 140, 'PG12', '2026-05-20',
        'ホアキン・ドス・サントス', 'シャメイク・ムーア、ヘイリー・スタインフェルド',
        'マイルス・モラレスが複数のスパイダーバース間を旅し、仲間たちと運命的な戦いに挑む。圧倒的なアニメーションで描くマルチバースの冒険。',
        '字幕,吹替', 1),

    ('怪物', 'MONSTER', 'ドラマ', 126, 'G', '2026-05-25',
        '是枝裕和', '安藤サクラ、永山瑛太、黒川想矢',
        'ある子供をめぐる「怪物」探しを巡り、母親・教師・子供それぞれの視点から語られる謎めいた物語。カンヌ国際映画祭脚本賞受賞作。',
        '字幕なし', 1),

    ('インディ・ジョーンズ5', 'INDIANA JONES 5', 'アクション / アドベンチャー', 154, 'G', '2026-06-01',
        'ジェームズ・マンゴールド', 'ハリソン・フォード、フィービー・ウォーラー＝ブリッジ',
        '伝説の考古学者インディ・ジョーンズが最後の冒険へ。時空を超えた壮大なアドベンチャーが幕を開ける、シリーズ最終章。',
        '字幕,吹替', 1),

    ('近日公開作品 1', 'COMING SOON 1', '未定', NULL, '未定', '2026-07-01',
        '未定', '未定', '詳細は公開日程に合わせて順次発表予定です。', '', 0),

    ('近日公開作品 2', 'COMING SOON 2', '未定', NULL, '未定', '2026-08-01',
        '未定', '未定', '詳細は公開日程に合わせて順次発表予定です。', '', 0);

-- ============================================================
--  スケジュール挿入ヘルパー関数
-- ============================================================
CREATE OR REPLACE FUNCTION insert_schedule_seed(
    p_movie  INT, p_screen INT, p_date DATE, p_time TIME
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    sid INT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM t_schedule
        WHERE f_screen_id = p_screen AND f_show_date = p_date AND f_start_time = p_time
    ) THEN RETURN; END IF;

    INSERT INTO t_schedule (f_movie_id, f_screen_id, f_show_date, f_start_time, f_status)
    VALUES (p_movie, p_screen, p_date, p_time, 0)
    RETURNING f_schedule_id INTO sid;

    INSERT INTO t_screen_price (f_schedule_id, f_price_category_id, f_price)
    VALUES (sid, 1, 1900), (sid, 2, 1300), (sid, 3, 1200);

    INSERT INTO t_seat_stock (f_schedule_id, f_seat_id, f_stock_status)
    SELECT sid, f_seat_id, 0 FROM t_seat WHERE f_screen_id = p_screen;
END;
$$;

-- ============================================================
--  シードデータ（スケジュール: 今日〜14日分）
-- ============================================================
DO $$
DECLARE
    d    DATE;
    sc1  INT;
    sc2  INT;
    sc3  INT;
    sc4  INT;
    m1   INT;
    m2   INT;
    m3   INT;
    m4   INT;
    m5   INT;
    m6   INT;
BEGIN
    SELECT f_screen_id INTO sc1 FROM t_screen WHERE f_screen_name = 'SC1';
    SELECT f_screen_id INTO sc2 FROM t_screen WHERE f_screen_name = 'SC2';
    SELECT f_screen_id INTO sc3 FROM t_screen WHERE f_screen_name = 'SC3';
    SELECT f_screen_id INTO sc4 FROM t_screen WHERE f_screen_name = 'SC4';
    SELECT f_movie_id  INTO m1  FROM t_movie WHERE f_title = 'ゴジラ-1.0';
    SELECT f_movie_id  INTO m2  FROM t_movie WHERE f_title = '名探偵コナン 黒鉄の魚影';
    SELECT f_movie_id  INTO m3  FROM t_movie WHERE f_title = 'THE FIRST SLAM DUNK';
    SELECT f_movie_id  INTO m4  FROM t_movie WHERE f_title = 'スパイダーマン:アクロス';
    SELECT f_movie_id  INTO m5  FROM t_movie WHERE f_title = '怪物';
    SELECT f_movie_id  INTO m6  FROM t_movie WHERE f_title = 'インディ・ジョーンズ5';

    FOR day_offset IN 0..13 LOOP
        d := CURRENT_DATE + day_offset;
        PERFORM insert_schedule_seed(m1, sc1, d, '08:30');
        PERFORM insert_schedule_seed(m1, sc1, d, '11:00');
        PERFORM insert_schedule_seed(m1, sc1, d, '14:30');
        PERFORM insert_schedule_seed(m1, sc1, d, '18:30');
        PERFORM insert_schedule_seed(m1, sc2, d, '09:00');
        PERFORM insert_schedule_seed(m1, sc2, d, '13:30');
        PERFORM insert_schedule_seed(m2, sc3, d, '10:00');
        PERFORM insert_schedule_seed(m2, sc3, d, '15:00');
        PERFORM insert_schedule_seed(m2, sc3, d, '19:30');
        PERFORM insert_schedule_seed(m3, sc1, d, '21:00');
        PERFORM insert_schedule_seed(m3, sc2, d, '17:00');
        PERFORM insert_schedule_seed(m4, sc2, d, '20:30');
        PERFORM insert_schedule_seed(m4, sc3, d, '12:00');
        PERFORM insert_schedule_seed(m5, sc4, d, '11:00');
        PERFORM insert_schedule_seed(m5, sc4, d, '15:00');
        PERFORM insert_schedule_seed(m6, sc4, d, '13:00');
        PERFORM insert_schedule_seed(m6, sc4, d, '18:00');
    END LOOP;
END$$;
