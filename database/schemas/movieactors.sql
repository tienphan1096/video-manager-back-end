CREATE TABLE movieactors (
    movieId INT,
    actorId INT,
    PRIMARY KEY(movieId, actorId),
    FOREIGN KEY (movieId) REFERENCES movies(id),
    FOREIGN KEY (actorId) REFERENCES actors(id)
)