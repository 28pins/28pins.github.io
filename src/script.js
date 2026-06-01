function verify(urlBase) {
    if (urlBase === "gl-zip" || urlBase === "sv-zip") {
        window.location.href = urlBase.replace("-zip", "") + "/index.html";
    }
    if (!urlBase.endsWith("/")) {
        urlBase += "/";
    }
    document.getElementsByTagName("form")[0].innerHTML = `
        <label for="password">Enter the password:</label>
        <input type="password" id="password" name="password">
        <input type="button" value="Submit">
    `;

    function handleSubmit(event) {
        event.preventDefault();
        const password = document.getElementById("password").value.toLowerCase().replace(" ", "");
        if (password.includes("come") && password.includes("unto") && password.includes("christ")) {
            window.open(urlBase + "index.html", "_self");
        } else {
            alert("Incorrect password. Please try again.");
        }
    }

    document.getElementsByTagName("form")[0].addEventListener("submit", handleSubmit);
    document.getElementsByTagName("input")[1].addEventListener("click", handleSubmit);
}
function populate(type) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "../ardata.json", true);
    xhr.onload = function () {
        if (xhr.status === 200) {
            const parsed = JSON.parse(xhr.responseText);
            const data = parsed.games || [];
            const tabScroller = document.getElementById("tab-scroller");
            const contentArea = document.getElementById("content-area");
            let tabs = [];
            const isGameLeader = type === "gl";
            // Use the games array directly and normalize "N/A" -> ""
            let jsonData = data;
            jsonData.forEach((item, idx) => {
                for (const key in item) {
                    if (item[key] === "N/A") {
                        item[key] = "";
                    }
                }
                if (isGameLeader || verifyVolunteer(item, "sv")) {
                    tabs.push(idx);
                }
            });
            let i = 0;
            tabs.forEach((tabIndex) => {
                const tabElement = document.createElement("div");
                tabElement.className = "tab";
                const tab = jsonData[tabIndex];
                tabElement.textContent = tab.name.replace(/_/g, " ").toLowerCase().replace(/(^|\s)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
                tabElement.id = `tab-index-${i}`;
                tabElement.addEventListener("click", () => {
                    setJSONData(tabIndex, jsonData, type);
                    tabElement.classList.add("active");
                    const otherTabs = document.querySelectorAll(".tab");
                    otherTabs.forEach((otherTab) => {
                        if (otherTab !== tabElement) {
                            otherTab.classList.remove("active");
                        }
                    });
                    tabElement.scrollIntoView({ behavior: 'smooth', inline: 'start' });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
                tabScroller.appendChild(tabElement);
                i++;
            });
            tabScroller.firstChild.classList.add("active");
            setJSONData(0, jsonData, type);
        }
    };
    xhr.send();
}

function setJSONData(index, jsonData, type) {
    const subTabScroller = document.getElementById("sub-tab-scroller");
    const contentArea = document.getElementById("content-area");
    subTabScroller.innerHTML = "";
    contentArea.innerHTML = "";
    const item = jsonData[index];
    for (const key in item) {
        if (item[key] !== "N/A" && item[key] !== "") {
            const subTabElement = document.createElement("div");
            subTabElement.className = "sub-tab";
            subTabElement.innerHTML = `<a href="#${key}">${key.replace(/_/g, " ").toLowerCase().replace(/(^|\s)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase())}</a>`;
            subTabElement.addEventListener("click", () => {
                const contentElement = document.getElementById(key);
                if (contentElement) {
                    contentElement.scrollIntoView({ behavior: "smooth" });
                }
                contentElement.classList.add("active");
                setTimeout(() => {
                    contentElement.classList.remove("active");
                    contentElement.classList.add("highlight");
                }, 500);
                subTabElement.classList.add("active");
                const otherSubTabs = document.querySelectorAll(".sub-tab");
                otherSubTabs.forEach((otherSubTab) => {
                    if (otherSubTab !== subTabElement) {
                        otherSubTab.classList.remove("active");
                    }
                });
                subTabElement.scrollIntoView({ behavior: 'smooth', inline: 'start' });
            });
            subTabElement.id = `sub-tab-${key}`;
            subTabScroller.appendChild(subTabElement);
        }
    }
    subTabScroller.firstChild.classList.add("active");
    for (const key in item) {
        if (item[key] !== "N/A" && item[key] !== "") {
            if (key === "read_to_the_youth" || key === "instructions" || key === "Follow-up" || key === "answer") {
                if (type === "sv") {
                    return;
                }
            }
            const contentElement = document.createElement("div");
            contentElement.className = "content";
            contentElement.id = key;
            if (key === "name") {
                contentElement.innerHTML = `<h1>${item[key].replace(/_/g, " ").toLowerCase().replace(/(^|\s)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase())}</h1><hr>`;
            } else {
                contentElement.innerHTML = `<h2>${key.replace(/_/g, " ").toLowerCase().replace(/(^|\s)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase())}</h2><p>${item[key]}</p>`;
            }
            contentArea.appendChild(contentElement);
        }
    }
}

function verifyVolunteer(item, role) {
    if (role === "sv") {
        return item.materials !== "N/A" || item.prep !== "N/A";
    }
    if (role === "gl") {
        return true;
    }
    return false;
}