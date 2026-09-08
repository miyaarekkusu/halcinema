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
    f_poster_slug   VARCHAR(100),
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
--  4b. 上映枠テーブル  t_SLOT
--  ※ 枠方式の中核。スクリーン×日付ごとに固定の枠を用意し、そこへ映画を割り当てる
-- ============================================================
CREATE TABLE t_SLOT (
    f_slot_id       SERIAL    PRIMARY KEY,
    f_screen_id     INTEGER   NOT NULL REFERENCES t_SCREEN (f_screen_id),
    f_show_date     DATE      NOT NULL,
    f_slot_order    SMALLINT  NOT NULL,
    f_start_time    TIME      NOT NULL,
    f_duration_min  SMALLINT  NOT NULL,
    f_slot_type     SMALLINT  NOT NULL DEFAULT 0
        CHECK (f_slot_type IN (0, 1)),

    CONSTRAINT uq_slot UNIQUE (f_screen_id, f_show_date, f_slot_order)
);

CREATE INDEX idx_slot_screen_date ON t_SLOT (f_screen_id, f_show_date);

-- ============================================================
--  5. 上映スケジュールテーブル  t_SCHEDULE
-- ============================================================
CREATE TABLE t_SCHEDULE (
    f_schedule_id  SERIAL   PRIMARY KEY,
    f_movie_id     INTEGER  NOT NULL REFERENCES t_MOVIE  (f_movie_id),
    f_screen_id    INTEGER  NOT NULL REFERENCES t_SCREEN (f_screen_id),
    f_slot_id      INTEGER           REFERENCES t_SLOT   (f_slot_id),
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
    f_guest_name          VARCHAR(100),
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
    f_goods_id             SERIAL        PRIMARY KEY,
    f_goods_name           VARCHAR(200)  NOT NULL,
    f_goods_type           VARCHAR(50)   NOT NULL DEFAULT '一般'
        CHECK (f_goods_type IN ('フード', 'ドリンク', 'グッズ', '一般')),
    f_price                INTEGER       NOT NULL,
    f_stock                INTEGER       NOT NULL DEFAULT 0,
    f_stock_unit           VARCHAR(10)   NOT NULL DEFAULT '個',
    f_stock_alert_threshold INTEGER      NOT NULL DEFAULT 10,
    f_is_active            SMALLINT      NOT NULL DEFAULT 1
        CHECK (f_is_active IN (0, 1)),
    f_created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
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
--  17. 管理者テーブル  t_ADMIN
-- ============================================================
CREATE TABLE t_ADMIN (
    f_admin_id    SERIAL        PRIMARY KEY,
    f_admin_code  VARCHAR(50)   NOT NULL,
    f_admin_name  VARCHAR(50)   NOT NULL,
    f_password    VARCHAR(255)  NOT NULL,
    f_role        VARCHAR(20)   NOT NULL DEFAULT 'staff',
    f_created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_admin_code UNIQUE (f_admin_code)
);

-- ============================================================
--  18. 振替履歴テーブル  t_SCHEDULE_CHANGE_LOG
--  ※ 枠・時刻・スクリーン変更／中止の履歴（機材故障・人的ミス・劇場都合等）
-- ============================================================
CREATE TABLE t_SCHEDULE_CHANGE_LOG (
    f_change_id        SERIAL      PRIMARY KEY,
    f_schedule_id      INTEGER     NOT NULL REFERENCES t_SCHEDULE (f_schedule_id),
    f_change_type      SMALLINT    NOT NULL
        CHECK (f_change_type IN (1, 2, 3, 4)),
    f_from_slot_id     INTEGER              REFERENCES t_SLOT (f_slot_id),
    f_to_slot_id       INTEGER              REFERENCES t_SLOT (f_slot_id),
    f_from_start_time  TIME,
    f_to_start_time    TIME,
    f_reason           VARCHAR(255),
    f_changed_by       INTEGER              REFERENCES t_ADMIN (f_admin_id),
    f_changed_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_change_log_schedule ON t_SCHEDULE_CHANGE_LOG (f_schedule_id);

-- ============================================================
--  19. 通知テーブル  t_NOTIFICATION
--  ※ 振替・時刻/スクリーン変更・中止を予約者へ通知する
-- ============================================================
CREATE TABLE t_NOTIFICATION (
    f_notification_id  SERIAL      PRIMARY KEY,
    f_member_id        INTEGER              REFERENCES t_MEMBER      (f_member_id),
    f_reservation_id   INTEGER     NOT NULL REFERENCES t_RESERVATION (f_reservation_id),
    f_type             SMALLINT    NOT NULL
        CHECK (f_type IN (1, 2, 3, 4)),
    f_message          VARCHAR(500) NOT NULL,
    f_is_read          SMALLINT    NOT NULL DEFAULT 0
        CHECK (f_is_read IN (0, 1)),
    f_created_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_reservation ON t_NOTIFICATION (f_reservation_id);
CREATE INDEX idx_notification_member      ON t_NOTIFICATION (f_member_id);

-- ============================================================
--  20. フード・グッズ注文テーブル  t_GOODS_ORDER
--  ※ 事前注文（予約とセット決済）・POS店頭販売の両方を扱う
--     f_order_type: 1=事前注文（f_reservation_idあり） / 2=POS店頭販売（f_reservation_id NULL）
-- ============================================================
CREATE TABLE t_GOODS_ORDER (
    f_order_id        SERIAL       PRIMARY KEY,
    f_reservation_id  INTEGER               REFERENCES t_RESERVATION (f_reservation_id),
    f_order_type      SMALLINT     NOT NULL
        CHECK (f_order_type IN (1, 2)),
    f_order_code      VARCHAR(20)  NOT NULL,
    f_total_amount    INTEGER      NOT NULL,
    f_order_status    SMALLINT     NOT NULL DEFAULT 0
        CHECK (f_order_status IN (0, 1, 2, 3)),
    f_ordered_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_delivered_at    TIMESTAMP,
    f_staff_id        INTEGER               REFERENCES t_ADMIN (f_admin_id),

    CONSTRAINT uq_goods_order_code UNIQUE (f_order_code)
);

CREATE INDEX idx_goods_order_reservation ON t_GOODS_ORDER (f_reservation_id);
CREATE INDEX idx_goods_order_status      ON t_GOODS_ORDER (f_order_status);

-- ============================================================
--  21. フード・グッズ注文明細テーブル  t_GOODS_ORDER_DETAIL
-- ============================================================
CREATE TABLE t_GOODS_ORDER_DETAIL (
    f_detail_id   SERIAL   PRIMARY KEY,
    f_order_id    INTEGER  NOT NULL REFERENCES t_GOODS_ORDER (f_order_id),
    f_goods_id    INTEGER  NOT NULL REFERENCES t_GOODS        (f_goods_id),
    f_quantity    INTEGER  NOT NULL,
    f_unit_price  INTEGER  NOT NULL
);

CREATE INDEX idx_goods_order_detail_order ON t_GOODS_ORDER_DETAIL (f_order_id);

-- ============================================================
--  22. スクリーン障害テーブル  t_SCREEN_INCIDENT
--  ※ f_resolved_at が NULL の行がある = そのスクリーンは現在使用不可
-- ============================================================
CREATE TABLE t_SCREEN_INCIDENT (
    f_incident_id    SERIAL       PRIMARY KEY,
    f_screen_id      INTEGER      NOT NULL REFERENCES t_SCREEN (f_screen_id),
    f_incident_type  VARCHAR(50)  NOT NULL,
    f_occurred_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_resolved_at    TIMESTAMP,
    f_reported_by    INTEGER               REFERENCES t_ADMIN (f_admin_id),
    f_resolved_by    INTEGER               REFERENCES t_ADMIN (f_admin_id)
);

CREATE INDEX idx_screen_incident_screen ON t_SCREEN_INCIDENT (f_screen_id);

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
--  ※ images/poster/ 配下の画像ファイル名（拡張子抜き）を f_poster_slug に対応させる
-- ============================================================
INSERT INTO t_MOVIE
    (f_title, f_title_en, f_genre, f_duration, f_rating, f_release_date,
     f_director, f_cast_info, f_synopsis, f_formats, f_poster_slug, f_is_showing)
VALUES
    ('ゴジラ-1.0', 'GODZILLA MINUS ONE', 'アクション / SF', 125, 'G', '2026-05-01',
        '山崎 貴', '神木隆之介、浜辺美波、山田裕貴',
        '戦後日本を舞台に、突如現れた巨大怪獣ゴジラが壊滅的な破壊をもたらす。何もかも失った人々が、絶望の中でゴジラに立ち向かう姿を描いた超大作。',
        '字幕,吹替', 'godzilla-minus-one', 1),

    ('名探偵コナン 黒鉄の魚影', 'DETECTIVE CONAN: BLACK IRON SUBMARINE', 'アニメ / ミステリー', 113, 'G', '2026-05-08',
        '立川譲', '高山みなみ、山崎和佳奈、神谷明',
        '世界各国の警察データを管理する巨大海上施設「パシフィック・ブイ」を舞台に、コナンが国際組織の陰謀に挑む。',
        '字幕', 'conan-black-iron', 1),

    ('THE FIRST SLAM DUNK', 'THE FIRST SLAM DUNK', 'アニメ / スポーツ', 124, 'G', '2026-05-15',
        '井上雄彦', '仲村宗悟、笠間淳、木村昴',
        'バスケットボールに青春を賭けた湘北高校の5人が、全国制覇を目指す姿を圧倒的な映像と音楽で描く完全新作劇場版。',
        '字幕なし', 'first-slam-dunk', 1),

    ('スパイダーマン:アクロス', 'SPIDER-MAN: ACROSS THE SPIDER-VERSE', 'アクション / SF', 140, 'PG12', '2026-05-20',
        'ホアキン・ドス・サントス', 'シャメイク・ムーア、ヘイリー・スタインフェルド',
        'マイルス・モラレスが複数のスパイダーバース間を旅し、仲間たちと運命的な戦いに挑む。圧倒的なアニメーションで描くマルチバースの冒険。',
        '字幕,吹替', NULL, 1),

    ('怪物', 'MONSTER', 'ドラマ', 126, 'G', '2026-05-25',
        '是枝裕和', '安藤サクラ、永山瑛太、黒川想矢',
        'ある子供をめぐる「怪物」探しを巡り、母親・教師・子供それぞれの視点から語られる謎めいた物語。カンヌ国際映画祭脚本賞受賞作。',
        '字幕なし', NULL, 1),

    ('インディ・ジョーンズ5', 'INDIANA JONES 5', 'アクション / アドベンチャー', 154, 'G', '2026-06-01',
        'ジェームズ・マンゴールド', 'ハリソン・フォード、フィービー・ウォーラー＝ブリッジ',
        '伝説の考古学者インディ・ジョーンズが最後の冒険へ。時空を超えた壮大なアドベンチャーが幕を開ける、シリーズ最終章。',
        '字幕,吹替', NULL, 1),

    ('ちいかわ セイレーン編', 'CHIIKAWA: THE SIREN ISLAND', 'アニメ / ファミリー', 70, 'G', '2026-06-05',
        '未定', '（声の出演なし）',
        'イラストレーター・ナガノ原作の大人気コンテンツ「ちいかわ」の劇場版。「特別な島」への招待状に釣られて島合宿に参加したちいかわたちが繰り広げる大冒険を描く。',
        '字幕なし', 'chiikawa-mermaid-island', 1),

    ('魔女の宅急便 4K', 'KIKI''S DELIVERY SERVICE (4K)', 'アニメ / ファンタジー', 102, 'G', '2026-06-08',
        '宮崎駿', '高山みなみ、佐久間レイ',
        '魔女の血をひく13歳の少女キキが、相棒の黒猫ジジと見知らぬ町で宅急便屋を開業し、様々な人々と出会いながら成長していくスタジオジブリの名作を4Kリマスターで上映。',
        '字幕なし', 'majo-no-takkyubin-4k', 1),

    ('プレジデンツ・ケーキ', 'THE PRESIDENT''S CAKE', 'ドラマ', 110, 'PG12', '2026-06-12',
        'ハサン・ハディ', '未定',
        '独裁政権下のイラクを舞台に、大統領の誕生日を祝うケーキ作りを任された少女の姿を描くヒューマンドラマ。カンヌ国際映画祭で高い評価を得た話題作。',
        '字幕なし', 'presidents-cake', 1),

    ('口に関するアンケート', 'A SURVEY ABOUT LIPS', 'ホラー / ミステリー', NULL, 'PG12', '2026-07-10',
        '清水崇', '板垣李光人、綱啓永、吉川愛',
        '心霊スポットの「呪われた木」を肝試しに訪れた大学生グループの1人が消息を絶つ。残された5人の証言から浮かび上がる恐ろしい真相を描く、ベストセラー小説の映画化。',
        '', 'kuchi-ni-kansuru-anketo', 0),

    ('君たちはどう生きるか', 'THE BOY AND THE HERON', 'アニメ / ファンタジー', 124, 'G', '2026-07-24',
        '宮崎駿', '未定',
        '母を亡くした少年・眞人が、不思議なアオサギに導かれ現実と幻想が入り混じる塔の世界に迷い込む。スタジオジブリ・宮崎駿監督による長編アニメーション。',
        '', 'boy-and-the-heron', 0),

    ('プラダを着た悪魔2', 'THE DEVIL WEARS PRADA 2', 'ドラマ / コメディ', NULL, 'G', '2026-08-07',
        'デヴィッド・フランケル', 'メリル・ストリープ、アン・ハサウェイ、エミリー・ブラント',
        'カリスマ編集長ミランダと、彼女のもとで奮闘したアンディの物語が帰ってくる。ファッション誌業界の変化を背景に描く人気シリーズの続編。',
        '', 'devil-wears-prada-2', 0),

    ('マイケル', 'MICHAEL', '伝記 / ドラマ', NULL, 'PG12', '2026-08-21',
        'アントワン・フークア', 'ジャアファー・ジャクソン',
        '“キング・オブ・ポップ”マイケル・ジャクソンの波乱に満ちた生涯を、甥のジャアファー・ジャクソンが本人役を演じて描く本格伝記映画。',
        '', 'michael', 0),

    ('トイ・ストーリー５', 'TOY STORY 5', 'アニメ / ファミリー', NULL, 'G', '2026-09-04',
        '未定', '未定',
        'ウッディやバズたちおもちゃの仲間が帰ってくる、大人気シリーズ最新作。詳細は公開日程に合わせて順次発表予定です。',
        '', 'toy-story-5', 0);

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
    m7   INT;
    m8   INT;
    m9   INT;
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
    SELECT f_movie_id  INTO m7  FROM t_movie WHERE f_title = 'ちいかわ セイレーン編';
    SELECT f_movie_id  INTO m8  FROM t_movie WHERE f_title = '魔女の宅急便 4K';
    SELECT f_movie_id  INTO m9  FROM t_movie WHERE f_title = 'プレジデンツ・ケーキ';

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
        PERFORM insert_schedule_seed(m7, sc3, d, '09:00');
        PERFORM insert_schedule_seed(m7, sc3, d, '13:00');
        PERFORM insert_schedule_seed(m7, sc3, d, '17:30');
        PERFORM insert_schedule_seed(m8, sc2, d, '10:30');
        PERFORM insert_schedule_seed(m8, sc2, d, '15:30');
        PERFORM insert_schedule_seed(m9, sc4, d, '09:30');
        PERFORM insert_schedule_seed(m9, sc4, d, '16:30');
    END LOOP;
END$$;
