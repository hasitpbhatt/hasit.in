-- Blog tables
-- Run: wrangler d1 execute hasit-in --remote --file=./migrations/006_blog.sql

CREATE TABLE IF NOT EXISTS blog_posts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    excerpt         TEXT,
    content_md      TEXT NOT NULL,               -- Markdown source
    content_html    TEXT NOT NULL,               -- Rendered HTML
    author_id       INTEGER NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
    published_at    INTEGER,                     -- Null = draft
    created_at      INTEGER DEFAULT (unixepoch()),
    updated_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at);

CREATE TABLE IF NOT EXISTS blog_tags (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT UNIQUE NOT NULL,
    slug            TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_post_tags (
    post_id         INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id          INTEGER NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);