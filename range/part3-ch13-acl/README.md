# Chapter 13 practice range (local only)

A deliberately leaky copy of the chapter's accounts service. It is a practice target for **your own machine**:
it refuses to listen on anything but loopback and refuses non-loopback clients. Never point it, or the
techniques in the chapter, at a system you do not own or have written permission to test.

```sh
# 1. a local Postgres 14+ on 127.0.0.1:55432 with a database named acl
createdb -h 127.0.0.1 -p 55432 acl
psql -h 127.0.0.1 -p 55432 -d acl -f schema.sql && psql -h 127.0.0.1 -p 55432 -d acl -f rls.sql

# 2. start the range
go run ./cmd/range            # http://127.0.0.1:8613, list the labs at /labs

# 3. find each flaw, submit the flag at /verify?lab=<id>&flag=<flag>

# 4. then fix it: the same three flaws, as a failing test
go test -run TestFixLab .     # goes green when the v0 routes stop leaking
```

Labs: `bola`, `list`, `tenant`. `run.sh` reproduces every number in the chapter.
