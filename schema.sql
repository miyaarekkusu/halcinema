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
    f_genre         VARCHAR(50)  NOT NULL,
    f_duration      SMALLINT     NOT NULL,
    f_rating        VARCHAR(10)  NOT NULL,
    f_release_date  DATE         NOT NULL,
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
--  初期データ（料金区分マスタ）
-- ============================================================
INSERT INTO t_PRICE_CATEGORY (f_category_name) VALUES
    ('一般'),
    ('学生'),
    ('シニア');
