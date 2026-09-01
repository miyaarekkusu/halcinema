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
        CHECK (f_is_showing IN (0, 1)),
    f_trailer_id    VARCHAR(20)
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
     f_director, f_cast_info, f_synopsis, f_formats, f_is_showing, f_trailer_id)
VALUES
    ('ゴジラ-1.0', 'GODZILLA MINUS ONE', 'アクション / SF', 120, 'G', '2026-05-01',
        '山崎 貴', '神木隆之介、浜辺美波、山田裕貴',
        '日本が生んだ特撮怪獣映画の金字塔「ゴジラ」の生誕70周年記念作品で、日本で製作された実写のゴジラ映画としては通算30作目。「ALWAYS 三丁目の夕日」シリーズをはじめ「永遠の0」「寄生獣」など数々の話題作を生み出してきたヒットメーカーの山崎貴が監督・脚本・VFXを手がけた。<br><br>タイトルの「－1.0」の読みは「マイナスワン」。舞台は戦後の日本。戦争によって焦土と化し、なにもかもを失い文字通り「無（ゼロ）」になったこの国に、追い打ちをかけるように突如ゴジラが出現する。ゴジラはその圧倒的な力で日本を「負（マイナス）」へと叩き落とす。戦争を生き延びた名もなき人々は、ゴジラに対して生きて抗う術を探っていく。<br><br>主演を神木隆之介、ヒロイン役を浜辺美波が務め、NHK連続テレビ小説「らんまん」でも夫婦役を演じて話題を集めた2人が共演。戦争から生還するも両親を失った主人公の敷島浩一を神木、焼け野原の戦後日本をひとり強く生きるなかで敷島と出会う大石典子を浜辺が演じる。そのほかのキャストに山田裕貴、青木崇高、吉岡秀隆、安藤サクラ、 佐々木蔵之介ら。2023年12月にはアメリカでも公開され、全米歴代邦画実写作品の興行収入1位を記録するなど大ヒットを記録。第96回アカデミー賞では日本映画として初めて視覚効果賞を受賞するという快挙を達成した。第47回日本アカデミー賞でも最優秀作品賞ほか同年度最多8部門の最優秀賞を受賞した。',
        '字幕,吹替', 1, 'x7ythIm0834'),

    ('名探偵コナン 黒鉄の魚影', 'DETECTIVE CONAN: BLACK IRON SUBMARINE', 'アニメ / ミステリー', 98, 'G', '2026-05-08',
        '立川譲', '高山みなみ、山崎和佳奈、神谷明',
        '大ヒットアニメ「名探偵コナン」の劇場版シリーズ26作目。<br><br>世界中の警察が持つ防犯カメラをつなぐ海洋施設「パシフィック・ブイ」が東京・八丈島近海に建設され、本格稼働に向けて世界各国のエンジニアが集結。顔認証システムを応用した、ある新技術のテストが行われていた。一方、コナンたち少年探偵団は、園子の招待で八丈島にホエールウォッチングに来ていた。するとコナンのもとへ沖矢昴（赤井秀一）から、ユーロポールの職員が、ドイツで黒づくめの組織のジンに殺害されたという知らせが入る。不穏に思ったコナンはパシフィック・ブイに潜入するが、そこでひとりの女性エンジニアが黒ずくめの組織に誘拐される事件が発生。そして、八丈島に宿泊していた灰原のもとにも黒い影が忍び寄る。<br><br>物語の舞台となるインターポールの海洋施設「パシフィック・ブイ」の局長・牧野洋輔役で沢村一樹がゲスト声優出演。監督は「名探偵コナン　ゼロの執行人」を手がけた立川譲。',
        '字幕,吹替', 1, 'YKx9O6qsG-E'),

    ('THE FIRST SLAM DUNK', 'THE FIRST SLAM DUNK', 'アニメ / スポーツ', 135, 'G', '2026-05-10',
        '井上雄彦', '仲村宗悟、笠間淳、木村昴',
        '1990年から96年まで「週刊少年ジャンプ」で連載され、以降も絶大な人気を誇る名作バスケットボール漫画「SLAM DUNK」を、原作者の井上雄彦が自ら監督・脚本を手がけ、新たにアニメーション映画化。<br><br>いつも余裕をかましながら頭脳的なプレーと電光石火のスピードで相手を翻弄する、湘北高校バスケ部の切り込み隊長、ポイントガードの宮城リョータ。沖縄で生まれ育った彼には3つ年上の兄ソータがいた。兄は地元のミニバスチームで有名な選手で、リョータも兄の背中を追うようにバスケを始めた。やがて一家は沖縄から神奈川へ引っ越し、湘北高校に進学したリョータはバスケ部に入部。2年生になったリョータは、1年生の桜木花道、流川楓、3年生の赤木剛憲、三井寿らとともにインターハイに出場し、絶対王者と呼ばれる強豪・山王工業高校と対戦する。<br><br>1990年代のテレビアニメ版からキャストは一新し、リョータ役に「ブルーロック」の仲村宗悟、三井役に「ガンダムビルドダイバーズ」の笠間淳、流川役に「ヒプノシスマイク」の神尾晋一郎、桜木役に「ドラえもん」の木村昴、赤木役に「僕のヒーローアカデミア」の三宅健太らを起用。ロックバンドの「The Birthday」がオープニング主題歌、「10-FEET」がエンディング主題歌を務め、作曲家・音楽プロデューサーの武部聡志と「10-FEET」のTAKUMAが音楽を担当。<br><br>2022年12月3日の公開から23年8月31日の終映まで約9カ月間のロングラン上映となり、興行収入は国内歴代13位となる157億円を突破する大ヒット作となった。<br><br>2025年10月13日からは「THE FIRST SLAM DUNK 2025 in cinema」と題し、Dolby Cinemaによるラージフォーマット上映を含めて2週間限定上映。',
        '字幕なし', 1, '9o7-Cgetho4'),

    ('君たちはどう生きるか', 'THE BOY AND THE HERON', 'アニメ / ファンタジー', 110, 'G', '2026-05-12',
        '宮崎 駿', '山時聡真、菅田将暉、柴咲コウ',
        '宮﨑駿監督が2013年公開の「風立ちぬ」以来10年ぶりに世に送り出した、スタジオジブリの長編アニメーション。「風立ちぬ」公開後に表明した長編作品からの引退を撤回して手がけ、宮﨑監督の記憶に残るかつての日本を舞台に、自らの少年時代を重ねた自伝的要素を含むファンタジー。<br><br>母親を火事で失った少年・眞人（まひと）は父の勝一とともに東京を離れ、「青鷺屋敷」と呼ばれる広大なお屋敷に引っ越してくる。亡き母の妹であり、新たな母親になった夏子に対して複雑な感情を抱き、転校先の学校でも孤立した日々を送る眞人。そんな彼の前にある日、鳥と人間の姿を行き来する不思議な青サギが現れる。その青サギに導かれ、眞人は生と死が渾然一体となった世界に迷い込んでいく。<br><br>宮﨑監督が原作・脚本も務めたオリジナルストーリーで、タイトルは宮﨑監督が少年時代に読んだという、吉野源三郎の著書「君たちはどう生きるか」から借りたもの。主人公の少年・眞人役の声は、映画「死刑にいたる病」などに出演する若手俳優の山時聡真。そのほかの声の出演に菅田将暉、柴咲コウ、あいみょん、木村佳乃、木村拓哉、大竹しのぶ、國村準、小林薫、火野正平ら。作画監督は「新世紀エヴァンゲリオン」シリーズで知られる本田雄、音楽は宮﨑作品を支えてきた久石譲、主題歌は米津玄師の書き下ろし新曲「地球儀」。<br><br>タイトルとポスター1枚が発表された以外、映画の内容やキャスト、スタッフの情報なども明らかにされず、一切のプロモーションが行われないまま劇場公開を迎えるという異例の展開で話題を集めた。アメリカでも高い評価を得て、第81回ゴールデングローブ賞では日本作品で初めてアニメーション映画賞を受賞し、第96回アカデミー賞でも宮﨑監督作およびジブリ作品として「千と千尋の神隠し」以来となる2度目の長編アニメーション賞受賞という快挙を成し遂げた。',
        '字幕,吹替', 1, 'abKcYyQ1V7Y'),

    ('プラダを着た悪魔２', 'THE DEVIL WEARS PRADA 2', 'ドラマ / コメディ', 115, 'G', '2026-05-15',
        'デヴィッド・フランケル', 'アン・ハサウェイ、メリル・ストリープ、エミリー・ブラント',
        'アメリカの小説家ローレン・ワイズバーガーの同名ベストセラーを原作とする2006年の大ヒット映画「プラダを着た悪魔」の20年ぶりとなる続編。<br></br>ニューヨークの一流ファッション誌「ランウェイ」のカリスマ編集長として、ファッション業界の頂点に君臨するミランダ。かつてそのアシスタントに採用され、厳しく完璧主義な彼女のもとで奮闘する日々を過ごしたアンドレアは、現在は報道記者として活躍していた。そんなある日、ミランダとその右腕ナイジェルが危機に直面していることを知ったアンドレアは、特集エディターとして「ランウェイ」編集部に舞い戻る。さらに、アシスタント時代の同僚エミリーとも再会するが、彼女はラグジュアリーブランドの幹部として「ランウェイ」存続の鍵を握る存在となっていた。それぞれの夢と野望がぶつかり合うなか、事態は思わぬ方向へと展開していく。<br></br>キャストにはミランダ役のメリル・ストリープ、アンドレア役のアン・ハサウェイ、エミリー役のエミリー・ブラント、ナイジェル役のスタンリー・トゥッチら前作のメンバーが再結集。前作に引き続きデビッド・フランケルが監督、アライン・ブロッシュ・マッケンナが脚本を手がけた。',
        '字幕,吹替', 1, 'lRSK6fcETZY'),

    ('マイケル', 'MICHAEL', '伝記 / ドラマ / ミュージカル', 148, 'PG12', '2026-05-18',
        'アントワーン・フークア', 'ジャーファー・ジャクソン、オデッサ・A''ザイオン',
        '圧倒的な歌唱力と革新的なダンスパフォーマンスで時代や国境を越えて愛され続ける「キング・オブ・ポップ」ことマイケル・ジャクソンの人生を描いた伝記映画。「トレーニング デイ」「イコライザー」シリーズのアントワン・フークア監督がメガホンをとり、音楽の枠を超えて世界に多大な影響を与えたマイケルの物語を、数々の名曲と共に描き出す。</br></br>野心家の父ジョセフのもとで厳しいレッスンを受け、兄弟グループ「ジャクソン5」のメンバーとして幼くして成功を収めたマイケル・ジャクソン。やがて名プロデューサーのクインシー・ジョーンズと出会った彼は、ソロアーティストとして数々の歴史的名曲を生み出し、瞬く間に時代の寵児となっていく。しかしその栄光の裏には、早熟の天才ゆえの孤独感や、強権的な父の呪縛、家族への愛と自分の中にあふれるビジョンとの間で葛藤するひとりの人間の姿があった。</br></br>主演にはマイケルの実の甥であるジャファー・ジャクソンを抜てきし、幼少期のマイケルをジュリアーノ・クルー・バルディ、父ジョセフをコールマン・ドミンゴ、母キャサリンをニア・ロング、音楽プロデューサーのクインシー・ジョーンズをケンドリック・サンプソン、長年の弁護士ジョン・ブランカをマイルズ・テラーが演じた。「グラディエーター」のジョン・ローガンが脚本を手がけ、製作には「ボヘミアン・ラプソディ」のグレアム・キングが名を連ねる。',
        '字幕,吹替', 1, 'Obpwr5IhyjE'),

    ('口に関するアンケート', 'A SURVEY ABOUT LIPS', 'ドラマ', NULL, '未定', '2026-07-01',
        '未定', '未定',
        '「近畿地方のある場所について」でモキュメンタリーホラーブームの火付け役となった作家・背筋が2024年に発表し、手のひらサイズの装丁とわずか60ページという短い物語の中でしっかりと恐怖を味わえるとしてSNSを中心に大きな話題を呼んだベストセラー小説「口に関するアンケート」を映画化。「呪怨」シリーズの清水崇監督がメガホンをとり、板垣李光人が実写映画単独初主演を務めた。<br><br>ある大学生のグループが、心霊スポットとして知られる墓地の「呪われた木」についての噂を聞き、肝試しに訪れる。しかし翌日、グループの1人がこつ然と姿を消してしまう。それ以来、墓地を訪れた大学生たちの周囲で不可解な現象が起こりはじめ、彼らは次第に追い詰められていく。5人の大学生が語る不可解な証言に導かれ、恐ろしい真相が浮かび上がっていく。<br><br>大学生グループの1人である村井翔太を板垣李光人が演じ、グループのメンバー・竜也役で綱啓永、杏役で吉川愛、美玲役でMOMONA（ME：I）、面白半分で墓地を訪れる大学生・堀田役で森愁斗（BUDDiiS）、堀田に強引に墓地へ連れて行かれる川瀬役で西山智樹（TAGRIGHT）、失踪した大学生の行方を追う刑事・草壁役で中村獅童、週刊誌記者・西役で柄本時生が共演。',
        '字幕なし', 0, 'pe0VNpQOrLc'),

    ('トイ・ストーリー５', 'TOY STORY 5', 'アニメ / ファミリー', NULL, 'G', '2026-07-01',
        '未定', '未定',
        'おもちゃと子どもの絆を描いてきたディズニー＆ピクサーの人気作品「トイ・ストーリー」シリーズの第5作。現代的なテクノロジーというかつてない脅威を前に、ウッディとバズが再び手を取り立ち向かう姿を描く。<br><br>ボニーのもとで暮らすバズやジェシー、フォーキーたちは、これまでと変わらぬ日常を送っていた。しかし、最新型の電子タブレット「リリーパッド」がやってきたことで状況は一変。多機能なデバイスに夢中になるボニーの姿を前に、おもちゃたちは自分たちの存在意義に疑問を抱き始める。「おもちゃはもう必要とされていないのか」という不安が広がる中、仲間からのSOSを受けたウッディが再びボニーのもとへ戻り、バズと再会する。かつての名コンビは、おもちゃの居場所を守るため、新たな脅威に立ち向かう。<br><br>「ファインディング・ニモ」「ウォーリー」などで知られ、これまでの「トイ・ストーリー」シリーズでも原案や脚本を務めてきたアンドリュー・スタントンが監督・脚本を務め、シリーズを支えてきたクリエイターとして新たな物語を描き出す。共同監督に、ピクサーの短編「アルベルトの手紙」を手がけたケナ・ハリス。日本語吹き替え版ではウッディ役の唐沢寿明、バズ役の所ジョージをはじめ、日下由美、竜星涼らおなじみのキャストが参加している。',
        '字幕,吹替', 0, 'nsG6Mric9g0'),

    ('映画ちいかわ 人魚の島のひみつ', 'CHIIKAWA THE MOVIE: SECRET OF MERMAID ISLAND', 'アニメ / ファミリー', NULL, 'G', '2026-08-01',
        '未定', '未定',
        'イラストレーターのナガノが2020年よりX（旧Twitter）にて原作漫画を連載し、「日本キャラクター大賞グランプリ」を3度受賞、22年に放送開始されたテレビアニメもYouTubeでの見逃し配信総再生回数が4億回を超えるなど、数々の社会現象を巻き起こしてきた大人気コンテンツ「ちいかわ」をアニメーション映画化。原作者・ナガノによる完全監修のもと、原作漫画シリーズの中でも特に人気の高い長編エピソード「セイレーン編」を映像化し、とある島を訪れたちいかわたちが繰り広げる大冒険を壮大な音楽と迫力の映像で描き出す。<br><br>ある日、広場でくつろいでいたちいかわとハチワレのもとに、顔にチラシを貼り付けたうさぎが現れる。ハチワレがチラシの内容を確認すると、それは「特別な島」への招待状だった。「島でのカンタンな討伐で100倍の報酬をもらおう」「限定島ラーメンに限定スイーツ、甘いもの辛いもの全部実質無料」といった言葉に釣られて島合宿に参加することを決めたちいかわたちは、チラシの内容を怪しがるラッコとともに船に乗り込み、島に上陸するが……。<br><br>「ウマ娘　プリティーダービー　新時代の扉」などのCygamesPicturesがアニメーション制作を担当。',
        '字幕なし', 0, 'N5439yrq_l8'),

    ('魔女の宅急便 4Kリマスタリング版', 'KIKI''S DELIVERY SERVICE 4K REMASTER', 'アニメ / ファンタジー', 103, 'G', '2026-08-01',
        '宮崎 駿', '高山みなみ、佐久間レイ、山口勝平',
        '角野栄子の同名児童文学シリーズを、「天空の城ラピュタ」「となりのトトロ」の宮崎駿監督が映画化したスタジオジブリの長編劇場アニメーション。<br><br>魔女の母コキリと人間の父オキノのもとで天真爛漫に育った13歳の女の子キキは、古くからのしきたりに従い、魔女修行の旅に出る。黒猫のジジとともに海沿いの街コリコにたどりついたキキは、パン屋のおソノに気に入られ、彼女の家の離れに住まわせてもらいながら店の手伝いをすることに。やがて、ほうきで空を飛ぶ力を使って配達屋の仕事を始めたキキは、森の中に暮らす画学生のウルスラや友だちになった少年トンボらと交流しながら、少しずつ成長していく。<br><br>声の出演はキキ役に高山みなみ（ウルスラ役も担当）、ジジ役に佐久間レイ、おソノ役に戸田恵子、トンボ役に山口勝平。ヨーロッパをモデルとした街並みを背景に少女の成長を描き、1989年公開の邦画でナンバーワンとなる大ヒットを記録した。荒井由実（現・松任谷由実）の既存の楽曲「ルージュの伝言」「やさしさに包まれたなら」が主題歌として起用され、こちらも話題となった。<br><br>2026年6月には、スタジオジブリが監修した最高画質の4KデジタルリマスターでIMAX上映。',
        '字幕なし', 0, 'GNmpY9m4SCo'),

    ('大統領のケーキ', 'THE PRESIDENT''S CAKE', 'コメディ / ドラマ', NULL, '未定', '2026-09-01',
        '未定', '未定',
        '独裁政権下のイラクを舞台に、小学校で大統領の誕生日ケーキをつくる係に任命された少女の奮闘を描いたドラマ。<br><br>1990年代、イラク。国民が戦争と食糧不足に苦しむなか、フセイン大統領は自身の誕生日を祝うケーキをつくるよう、国内の各学校に命じていた。祖母と2人で暮らす9歳の少女ラミアは、小学校で行われたくじ引きで“名誉ある”ケーキ係に選ばれてしまう。ケーキを用意できなければ、重い罰が待っているという。翌朝、ラミアは祖母に連れられ、父の形見の時計と、彼女にとって友だちの雄鶏ヒンディと一緒に町へ出かける。しかし、日々の食材すら満足にそろえられない祖母の目的はケーキではなく、ラミアを養子に出すことだった。とっさに逃げ出したラミアは、自らの手でケーキの材料を集めれば祖母との暮らしを続けられると信じ、クラスメイトのサイードと協力して町を駆け巡るが……。<br><br>主人公ラミア役のバニーン・アハマド・ナーイフをはじめ、キャストには演技未経験者を起用。イラク出身のハサン・ハーディが自らの体験をもとに長編初監督・脚本を手がけ、2025年・第78回カンヌ国際映画祭にて、監督週間観客賞とカメラドール（新人監督賞）を受賞した。製作総指揮には「フォレスト・ガンプ　一期一会」などの脚本家エリック・ロスと「幸せへのまわり道」の監督マリエル・ヘラーが名を連ねる。',
        '字幕', 0, 'hlaBRfJa3Iw');

-- ============================================================
--  シードデータ（映画ポスター画像）
--  ※ f_image_url は images/poster/ の実ファイルと 1:1 で対応
-- ============================================================
INSERT INTO t_MOVIE_IMAGE (f_movie_id, f_image_type, f_image_url, f_alt_text, f_display_order)
SELECT m.f_movie_id, 'poster', v.url, v.alt, 0
FROM (VALUES
    ('ゴジラ-1.0', 'images/poster/godzilla-minus-one.jpg', 'ゴジラ-1.0 ポスター'),
    ('名探偵コナン 黒鉄の魚影', 'images/poster/conan-black-iron.jpg', '名探偵コナン 黒鉄の魚影 ポスター'),
    ('THE FIRST SLAM DUNK', 'images/poster/first-slam-dunk.jpg', 'THE FIRST SLAM DUNK ポスター'),
    ('君たちはどう生きるか', 'images/poster/boy-and-the-heron.jpg', '君たちはどう生きるか ポスター'),
    ('プラダを着た悪魔２', 'images/poster/devil-wears-prada-2.jpg', 'プラダを着た悪魔２ ポスター'),
    ('マイケル', 'images/poster/michael.jpg', 'マイケル ポスター'),
    ('口に関するアンケート', 'images/poster/kuchi-ni-kansuru-anketo.jpg', '口に関するアンケート ポスター'),
    ('トイ・ストーリー５', 'images/poster/toy-story-5.jpg', 'トイ・ストーリー５ ポスター'),
    ('映画ちいかわ 人魚の島のひみつ', 'images/poster/chiikawa-mermaid-island.jpg', '映画ちいかわ 人魚の島のひみつ ポスター'),
    ('魔女の宅急便 4Kリマスタリング版', 'images/poster/majo-no-takkyubin-4k.jpg', '魔女の宅急便 4Kリマスタリング版 ポスター'),
    ('大統領のケーキ', 'images/poster/presidents-cake.jpg', '大統領のケーキ ポスター')
) AS v (title, url, alt)
JOIN t_MOVIE m ON m.f_title = v.title;

-- t_MOVIE のメイン画像として上のポスターを紐付ける
UPDATE t_MOVIE m
SET f_image_id = i.f_image_id
FROM t_MOVIE_IMAGE i
WHERE i.f_movie_id = m.f_movie_id
  AND i.f_image_type = 'poster';

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
    SELECT f_movie_id  INTO m4  FROM t_movie WHERE f_title = '君たちはどう生きるか';
    SELECT f_movie_id  INTO m5  FROM t_movie WHERE f_title = 'プラダを着た悪魔２';
    SELECT f_movie_id  INTO m6  FROM t_movie WHERE f_title = 'マイケル';

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
