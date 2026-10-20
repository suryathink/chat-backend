CREATE TABLE IF NOT EXISTS users (
  id         CHAR(36)     NOT NULL,
  name       VARCHAR(100) NOT NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
);

-- A 1:1 chat. The two member ids are stored sorted (low < high) so the pair
-- (A, B) and (B, A) map to the same row; the UNIQUE key makes the database
-- reject duplicate chats even under concurrent "create chat" requests.
CREATE TABLE IF NOT EXISTS chats (
  id           CHAR(36)    NOT NULL,
  user_low_id  CHAR(36)    NOT NULL,
  user_high_id CHAR(36)    NOT NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_chats_pair (user_low_id, user_high_id),
  -- uq_chats_pair already serves lookups by user_low_id; this one serves user_high_id.
  KEY idx_chats_user_high (user_high_id),
  CONSTRAINT fk_chats_user_low  FOREIGN KEY (user_low_id)  REFERENCES users (id),
  CONSTRAINT fk_chats_user_high FOREIGN KEY (user_high_id) REFERENCES users (id),
  CONSTRAINT chk_chats_order CHECK (user_low_id < user_high_id)
);
