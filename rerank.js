let films = [];
let chosenFilms = [];
let graphContainer;
let svg;
let simulation;

function parseCSVLine(line) {
    let values = [];
    let current = "";
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        let char = line[i];
        if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
            values.push(current);
            current = "";
        } else {
            current += char;
        }
    }

    values.push(current);
    return values;
}

function loadValFromCSV() {
    fetch("imdb_top250_with_lb_rt_mc.csv")
        .then(function(response) {
            return response.text();
        })
        .then(function(csvText) {
            let lines = csvText.trim().split("\n");
            let headers = parseCSVLine(lines[0]);
            let dataRows = lines.slice(1);

            films = dataRows.map(function(line) {
                let values = parseCSVLine(line);
                let row = {};
                headers.forEach(function(header, index) {
                    row[header.trim()] = values[index] ? values[index].trim() : "";
                });
                return {
                    tconst: row.tconst,
                    primaryTitle: row.primaryTitle,
                    averageRating: parseFloat(row.averageRating),
                    letterboxdRatingOutOf5: parseFloat(row.letterboxdRatingOutOf5),
                    rottenTomatoesPercent: parseFloat(row.rottenTomatoesPercent),
                    metacriticScore: parseFloat(row.metacriticScore),
                    iMDBRank: row.imdbTop250Rank,
                    genres: row.genres
                };
            });
            drawGraph();
            showHighestDisagreement();
            showCriticVsAudience();
            showGenrePatterns();
        })
        .catch(function(error) {
            console.error("Error loading CSV:", error);
        });
}

function safe(value, max) {
    if (!value) return 0.5;
    return value / max;
}

function genreSimilarity(film, selected) {
    let filmGenres = film.genres.split(",");
    let selectedGenres = selected.genres.split(",");

    let shared = filmGenres.filter(function(i) {
        return selectedGenres.includes(i)
    });
    
    let maxGenres = Math.max(filmGenres.length, selectedGenres.length);
  
    return shared.length / maxGenres;
  }

function calculateScore(film, selected) {
    let diff =
    Math.abs(safe(film.averageRating, 10) - safe(selected.averageRating, 10)) +
    Math.abs(safe(film.letterboxdRatingOutOf5, 5) - safe(selected.letterboxdRatingOutOf5, 5)) +
    Math.abs(safe(film.rottenTomatoesPercent, 100) - safe(selected.rottenTomatoesPercent, 100)) +
    Math.abs(safe(film.metacriticScore, 100) - safe(selected.metacriticScore, 100));
    
    let genreBonus = genreSimilarity(film, selected) * 0.6;
    return diff - genreBonus;
}

function rerankFilms(films, selectedID) {
    let selected = films.find(function (i) {
        return i.tconst === selectedID;
    });
    
    if (!selected) {
        console.log("Film not found:", selectedID);
        return [];
    }
  
    let ranked = films.map(function(film) {
        return {
            ...film,
            score: calculateScore(film, selected)
        };
    });
    
    ranked.sort(function(a, b) {
        return a.score - b.score;
    });
  
    return ranked;
}

function getCardType(index) {
    if (index === 0) return "gold";
    if (index === 1) return "silver";
    if (index === 2) return "bronze";
    return "white";
}

function getSimilarityPercent(index) {
    let similarity = 100 - (index * 6);
    return Math.max(40, similarity);
}

function displaySelectedFilm(selected) {
    let selectedCard = document.getElementById("selected-card");
    selectedCard.innerHTML = `
        <div class="selected-film-card">
            <div class="selected-info">
                <h3>${selected.primaryTitle}</h3>
                <p>Genre: ${selected.genres}</p>
            </div>
            <div class="selected-label">Selected Film</div>
        </div>
    `;
}

function displayFilms(ranked, selected) {
    let container = document.getElementById("results");
    container.innerHTML = "";
    displaySelectedFilm(selected);
    ranked.slice(1, 11).forEach(function(film, index) {
        // potential change
        let similarity = getSimilarityPercent(index);
        let card = document.createElement("div");
        card.className = `film-card ${getCardType(index)}`;
        card.innerHTML = `
            <div class="rank-number">${index + 1}</div>
            <div class="film-info">
                <h3>${film.primaryTitle}</h3>
                <p>Genre: ${film.genres}</p>
            </div>
            <div class="similarity-area">
                <p>Similarity Score: ${similarity}%</p>
                <div class="similarity-bar">
                    <div 
                        class="similarity-fill"
                        style="width:${similarity}%">
                    </div>
                </div>
            </div>
            <div class="rank-change">
                IMDb #${film.iMDBRank}<br>Now #${index + 1}
            </div>
        `;
        card.addEventListener("click", function() {
            showRatingPanel(film);
        });
        container.appendChild(card);
    });
}


function showRatingPanel(film, panelID = "rating-panel") {
    let panel = document.getElementById(panelID);
    panel.classList.remove("hidden");
    panel.innerHTML = `
        <button class="close-button" onclick="closeRatingPanel('${panelID}')">X</button>
        <h2>${film.primaryTitle}</h2>
        <p class="panel-genre">${film.genres}</p>
        <div class="rating-grid">
            <div>
                <span>LB</span>
                <strong>${film.letterboxdRatingOutOf5 || "N/A"}</strong>
            </div>
            <div>
                <span>IMDb</span>
                <strong>${film.averageRating || "N/A"}</strong>
            </div>
            <div>
                <span>MC</span>
                <strong>${film.metacriticScore || "N/A"}</strong>
            </div>
            <div>
                <span>RT</span>
                <strong>${film.rottenTomatoesPercent ? film.rottenTomatoesPercent + "%" : "N/A"}</strong>
            </div>
        </div>
    `;
}

function closeRatingPanel(panelID = "rating-panel") {
    document.getElementById(panelID).classList.add("hidden");
}

function updateRanking(selectedID, button) {
    let ranked = rerankFilms(films, selectedID);
    let selected = films.find(function(i) {
        return i.tconst === selectedID;
    });
    document
        .querySelectorAll(".button-group button")
        .forEach(function(btn) {
            btn.style.background = "#eee";
        });

    if (button) {
        button.style.background = "#ccc";
    }

    displayFilms(ranked, selected);
}

function unorderedList(startRank, endRank, button) {
    let container = document.getElementById("imdb-list");
    container.innerHTML = "";

    document.querySelectorAll("#intro .button-group button").forEach(function(btn) {
        btn.style.background = "#eee";
    });

    if (button) {
        button.style.background = "#ccc";
    }

    let selectedFilms = films.filter(function(film) {
            let rank = parseInt(film.iMDBRank);
            return rank >= startRank && rank <= endRank;
        }).sort(function(a, b) {
            return parseInt(a.iMDBRank) - parseInt(b.iMDBRank);
        });

    selectedFilms.forEach(function(film, index) {
        let card = document.createElement("div");
        card.className = `film-card ${getCardType(index)}`;
        card.innerHTML = `
            <div class="rank-number">${film.iMDBRank}</div>
            <div class="film-info">
                <h3>${film.primaryTitle}</h3>
                <p>Genre: ${film.genres}</p>
            </div>

            <div class="similarity-area">
                <p>IMDb Rating: ${film.averageRating}</p>
                <p>IMDb Rank: #${film.iMDBRank}</p>
            </div>

            <div class="rank-change">Original List</div>`;

        card.addEventListener("click", function() {
            showRatingPanel(film, "intro-rating-panel");
        });

        container.appendChild(card);
    });
}

function searchFilms() {
    let input = document.getElementById("film-search").value.toLowerCase();
    let results = document.getElementById("search-results");

    results.innerHTML = "";

    if (input.length < 2) return;

    let matches = films.filter(function(film) {
            return film.primaryTitle.toLowerCase().includes(input);
        }).slice(0, 10);

    matches.forEach(function(film) {
        let button = document.createElement("button");
        button.textContent = film.primaryTitle;

        button.addEventListener("click", function() {
            addChosenFilm(film);
        });

        results.appendChild(button);
    });
}

function addChosenFilm(film) {
    if (chosenFilms.length >= 3) {
        alert("You can only choose up to 3 films.");
        return;
    }

    let alreadyChosen = chosenFilms.some(function(chosen) {
        return chosen.tconst === film.tconst;
    });

    if (alreadyChosen) return;

    chosenFilms.push(film);
    displayChosenFilms();
}

function displayChosenFilms() {
    let container = document.getElementById("chosen-films");
    container.innerHTML = "";

    chosenFilms.forEach(function(film, index) {
        let tag = document.createElement("button");
        tag.textContent = film.primaryTitle + "X";

        tag.addEventListener("click", function() {
            chosenFilms.splice(index, 1);
            displayChosenFilms();
        });

        container.appendChild(tag);
    });
}

function calculateMultiFilmScore(film, selectedFilms) {
    let total = 0;

    selectedFilms.forEach(function(selected) {
        total += calculateScore(film, selected);
    });

    return total / selectedFilms.length;
}

function generateCustomRanking() {
    if (chosenFilms.length === 0) {
        alert("Choose at least 1 film first.");
        return;
    }

    let ranked = films.filter(function(film) {
            return !chosenFilms.some(function(chosen) {
                return chosen.tconst === film.tconst;
            });
        }).map(function(film) {
            return {
                ...film,
                score: calculateMultiFilmScore(film, chosenFilms)
            };
        })
        .sort(function(a, b) {
            return a.score - b.score;
        });

    displayExploreFilms(ranked);
}

function displayExploreFilms(ranked) {
    let container = document.getElementById("explore-results");
    container.innerHTML = "";

    ranked.slice(0, 10).forEach(function(film, index) {
        let similarity = getSimilarityPercent(film.score);

        let card = document.createElement("div");
        card.className = `film-card ${getCardType(index)}`;

        card.innerHTML = `
            <div class="rank-number">${index + 1}</div>

            <div class="film-info">
                <h3>${film.primaryTitle}</h3>
                <p>Genre: ${film.genres}</p>
            </div>

            <div class="similarity-area">
                <p>Similarity Score: ${similarity}%</p>

                <div class="similarity-bar">
                    <div class="similarity-fill" style="width:${similarity}%"></div>
                </div>
            </div>

            <div class="rank-change">
                IMDb #${film.iMDBRank}
                <br>
                Now #${index + 1}
            </div>
        `;

        card.addEventListener("click", function() {
            showRatingPanel(film, "explore-rating-panel");
        });

        container.appendChild(card);
    });
}

function buildNetworkData() {
    let topFilms = films.filter(function(film) {
            return parseInt(film.iMDBRank) <= 150;
        });
    
    let nodes = topFilms.map(function(film) {
        return {
            id: film.tconst,
            title: film.primaryTitle,
            rank: parseInt(film.iMDBRank),
            genres: film.genres
        };
    });

    let links = [];
    topFilms.forEach(function(sourceFilm) {
        topFilms.forEach(function(targetFilm) {
            if (sourceFilm.tconst === targetFilm.tconst) return;
            let score = calculateScore(sourceFilm, targetFilm);
            if (score < -0.15) {
                links.push({
                    source: sourceFilm.tconst,
                    target: targetFilm.tconst,
                    score: score
                });
            }
        });
    });
    return {
        nodes: nodes,
        links: links
    };

}

function drawGraph() {
    let graphData = buildNetworkData();
    graphContainer = document.getElementById("network-graph");
    let width = graphContainer.clientWidth;
    let height = graphContainer.clientHeight;
    

    svg = d3.select("#network-graph")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);

    let tooltip = d3.select("body")
        .append("div")
        .style("position", "absolute")
        .style("background", "#f4eacd")
        .style("border", "2px solid #872e30")
        .style("padding", "10px")
        .style("color", "#872e30")
        .style("pointer-events", "none")
        .style("opacity", 0);

    let link = svg.selectAll("line")
        .data(graphData.links)
        .enter()
        .append("line")
        .attr("stroke", "#872e30")
        .attr("stroke-width", 1);

    let node = svg.selectAll("circle")
        .data(graphData.nodes)
        .enter()
        .append("circle")
        .attr("r",function(d){
            return Math.max(6, 14 - d.rank * 0.08);
        })
        .attr("fill", "#c79f4d")
        .on("mouseover", function(event, d) {
            let currentFilm = films.find(function(film) {
                return film.tconst === d.id;
            });
        
            let similarFilms = rerankFilms(films, d.id)
                .slice(1, 6)
                .map(function(film) {
                    return film.primaryTitle;
                });
        
            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.title}</strong>
                    <br><br>
                    Most Similar:
                    <br>
                    ${similarFilms.join("<br>")}
                `);
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY + 15) + "px");
        })
        .on("mouseout", function() {
            tooltip
                .style("opacity", 0);
        })
        .call(
            d3.drag().on("start", dragStarted)
                .on("drag", dragged)
                .on("end", dragEnded)
        );

    let label = svg.selectAll("text")
        .data(graphData.nodes)
        .enter()
        .append("text")
        .text(function(t) {
            return t.title;
        })
        .attr("font-size", "10px")
        .attr("fill","black");

    simulation = d3.forceSimulation(graphData.nodes)
        .force("link", d3.forceLink(graphData.links)
            .id(function(movie) {
                return movie.id;
            })
            .distance(140))
        .force("charge", d3.forceManyBody()
            .strength(-350))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("x", d3.forceX(width / 2).strength(0.08))
        .force("y", d3.forceY(height / 2).strength(0.08))
        .force("collision", d3.forceCollide()
            .radius(25));

    simulation.on("tick", function() {
        link.attr("x1", function(d) {
            return d.source.x;
        })
            .attr("y1", function(d) {
                return d.source.y;
            })
            .attr("x2", function(d) {
                return d.target.x;
            })
            .attr("y2", function(d) {
                return d.target.y;
            });
        node.attr("cx", function(d) {
            return d.x;
        })
            .attr("cy", function(d) {
                return d.y;
            });
        label.attr("x", function(d) {
            return d.x + 12;
        })
            .attr("y", function(d) {
                return d.y + 4;
            });
    });

    function dragStarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3)
            .restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragEnded(event, d) {
        if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
    }
}

function toggleGraphFullscreen() {
    let graph = document.getElementById("network-graph");
    if (!document.fullscreenElement) {
        graph.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function resizeGraph() {
    let newWidth = graphContainer.clientWidth;
    let newHeight = graphContainer.clientHeight;

    svg
        .attr("width", newWidth)
        .attr("height", newHeight)
        .attr("viewBox", `0 0 ${newWidth} ${newHeight}`);

    simulation
        .force("center", d3.forceCenter(newWidth / 2, newHeight / 2))
        .force("x", d3.forceX(newWidth / 2).strength(0.08))
        .force("y", d3.forceY(newHeight / 2).strength(0.08));

    simulation.alpha(0.5).restart();
}

function calculateDisagreement(film) {
    let scores = [
        safe(film.averageRating, 10),
        safe(film.letterboxdRatingOutOf5, 5),
        safe(film.rottenTomatoesPercent, 100),
        safe(film.metacriticScore, 100)
    ];

    let average = scores.reduce(function(total, score) {
        return total + score;
    }, 0) / scores.length;

    let disagreement = scores.reduce(function(total, score) {
        return total + Math.abs(score - average);
    }, 0) / scores.length;

    return disagreement;
}

function showHighestDisagreement() {
    let container = document.getElementById("highest-disagreement");

    let ranked = films.map(function(film) {
            return {
                ...film,
                disagreement: calculateDisagreement(film)
            };
        })
        .sort(function(a, b) {
            return b.disagreement - a.disagreement;
        })
        .slice(0, 5);

    container.innerHTML = `
        <h3>Films with the most platform disagreement:</h3>
        <p>These films have the biggest differences between IMDb, Letterboxd, Rotten Tomatoes and Metacritic.</p>
    `;

    ranked.forEach(function(film) {
        let item = document.createElement("p");
        item.textContent = `${film.primaryTitle} | disagreement score: ${film.disagreement.toFixed(2)}`;
        container.appendChild(item);
    });
}

function showCriticVsAudience() {
    let container = document.getElementById("critic-vs-audience");

    let ranked = films
        .map(function(film) {
            let audienceScore = (
                safe(film.averageRating, 10) +
                safe(film.letterboxdRatingOutOf5, 5)
            ) / 2;

            let criticScore = (
                safe(film.rottenTomatoesPercent, 100) +
                safe(film.metacriticScore, 100)
            ) / 2;

            return {
                ...film,
                audienceScore: audienceScore,
                criticScore: criticScore,
                difference: Math.abs(audienceScore - criticScore)
            };
        })
        .sort(function(a, b) {
            return b.difference - a.difference;
        })
        .slice(0, 5);

    container.innerHTML = `
        <h3>Biggest critic vs audience gaps:</h3>
        <p>These films show the largest difference between audience-based platforms and critic-based platforms.</p>
    `;

    ranked.forEach(function(film) {
        let item = document.createElement("p");

        item.textContent = 
            `${film.primaryTitle} | audience: ${(film.audienceScore * 100).toFixed(0)}%, critic: ${(film.criticScore * 100).toFixed(0)}%`;

        container.appendChild(item);
    });
}

function showGenrePatterns() {
    let container = document.getElementById("genre-patterns");

    let genreCounts = {};

    films.forEach(function(film) {
        let genres = film.genres.split(",");

        genres.forEach(function(genre) {
            genre = genre.trim();

            if (!genreCounts[genre]) {
                genreCounts[genre] = 0;
            }

            genreCounts[genre]++;
        });
    });

    let sortedGenres = Object.entries(genreCounts)
        .sort(function(a, b) {
            return b[1] - a[1];
        })
        .slice(0, 8);

    container.innerHTML = `
        <h3>Most common genres in the dataset:</h3>
        <p>This shows which genres dominate the IMDb Top 250 list.</p>
    `;

    sortedGenres.forEach(function(genreData) {
        let genre = genreData[0];
        let count = genreData[1];

        let item = document.createElement("p");
        item.textContent = `${genre}: ${count} films`;

        container.appendChild(item);
    });
}

document.addEventListener("fullscreenchange", resizeGraph);
window.addEventListener("resize", resizeGraph);
loadValFromCSV();
