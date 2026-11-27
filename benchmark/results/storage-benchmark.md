# Storage benchmark

Run 2026-11-24T04:18:57.002Z from the same machine against both stores. 200 timed calls per workload after 10 untimed,
4 at a time. Each figure is the median of 5 passes, and in every pass both stores run each workload back to
back, taking turns to go first. Dataset: 20 boards of 300 elements, 400 logged operations and a
version every 50 per board. Latencies are milliseconds measured at the client, so they include the network.

## Network baseline

| Store             | Round trip p50 | p95  |
| ----------------- | -------------- | ---- |
| Couchbase Capella | 36.5           | 42.5 |
| MongoDB Atlas     | 26.3           | 35.6 |

A store in a nearer region wins every call by about the difference, so the comparison below uses what each store adds
on top of a round trip measured just before that workload, not the raw latency.

## Workloads

| Workload                                                        | Store             | p50  | p95   | p99   | ops/s | Round trip p50 | p50 above round trip | Couchbase Capella vs MongoDB Atlas, above round trip |
| --------------------------------------------------------------- | ----------------- | ---- | ----- | ----- | ----- | -------------- | -------------------- | ---------------------------------------------------- |
| Open a board by its key                                         | Couchbase Capella | 63.5 | 144.2 | 150.0 | 55.7  | 36.8           | 27.1                 | 1.9x slower                                          |
|                                                                 | MongoDB Atlas     | 41.1 | 100.0 | 192.9 | 78.5  | 26.6           | 14.2                 |                                                      |
| Open a board by its share id (secondary index)                  | Couchbase Capella | 60.9 | 98.3  | 310.9 | 55.9  | 36.4           | 24.6                 | 1.6x slower                                          |
|                                                                 | MongoDB Atlas     | 41.9 | 74.6  | 95.1  | 84.4  | 26.6           | 15.3                 |                                                      |
| Autosave one changed element (field-level write)                | Couchbase Capella | 37.1 | 40.8  | 49.4  | 104.4 | 36.5           | 0.64                 | faster                                               |
|                                                                 | MongoDB Atlas     | 27.6 | 39.5  | 395.0 | 112.0 | 26.8           | 1.02                 |                                                      |
| 20 people editing different elements of one board at once       | Couchbase Capella | 40.0 | 72.6  | 91.9  | 23.4  | 37.3           | 2.98                 | 4.1x faster                                          |
|                                                                 | MongoDB Atlas     | 38.5 | 860.7 | 915.9 | 5.2   | 26.5           | 12.1                 |                                                      |
| Append a burst of 25 operations to the log                      | Couchbase Capella | 42.2 | 69.5  | 75.1  | 85.1  | 36.6           | 4.57                 | 1.4x faster                                          |
|                                                                 | MongoDB Atlas     | 33.0 | 44.0  | 250.9 | 103.8 | 26.5           | 6.49                 |                                                      |
| Read the operations after a version (replay, catch-up)          | Couchbase Capella | 59.8 | 72.5  | 230.4 | 64.2  | 36.7           | 22.0                 | 4.1x slower                                          |
|                                                                 | MongoDB Atlas     | 32.4 | 59.4  | 197.6 | 103.9 | 26.8           | 5.39                 |                                                      |
| Find the latest version at or before a point (history scrubber) | Couchbase Capella | 41.2 | 54.2  | 181.3 | 81.8  | 36.9           | 4.92                 | 4.0x slower                                          |
|                                                                 | MongoDB Atlas     | 27.7 | 39.1  | 366.1 | 111.0 | 26.6           | 1.23                 |                                                      |
| List a person's boards, newest first (dashboard)                | Couchbase Capella | 44.8 | 60.0  | 175.3 | 76.3  | 36.7           | 7.92                 | slower                                               |
|                                                                 | MongoDB Atlas     | 27.5 | 37.4  | 391.3 | 108.4 | 26.5           | 0.92                 |                                                      |

20 people editing different elements of one board at once: Couchbase Capella kept every write, MongoDB Atlas kept every write.
