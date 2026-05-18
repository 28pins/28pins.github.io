function verify(urlBase) {
    if (!urlBase.endsWith("/")) {
        urlBase += "/";
    }
    document.getElementsByTagName("form")[0].innerHTML = `
        <label for="password">Enter the password:</label>
        <input type="password" id="password" name="password">
        <input type="submit" value="Submit">
    `;

    document.getElementsByTagName("form")[0].addEventListener("submit", function (event) {
        event.preventDefault();
        const password = document.getElementById("password").value;
        if (password === "ComeUntoChrist") {
            window.open(urlBase + "index.html", "_self");
        } else {
            alert("Incorrect password. Please try again.");
        }
    });
}
function populate(type) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "ardata.json", true);
    xhr.onload = function () {
        if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            const tabScroller = document.getElementById("tab-scroller");
            const contentArea = document.getElementById("content-area");
            let tabs = [];
            const isGameLeader = type === "gl";
            let jsonData = {};
            data.forEach((item) => {
                jsonData[item.name] = item;
            });
            jsonData.forEach((item) => {
                item.forEach((subItem) => {
                    if (subItem === "N/A") { subItem = "" }
                });
            });
            jsonData.forEach((item) => {
                if (isGameLeader || verifyVolunteer(item, "sv")) {
                    tabs.push(item.name);
                }
            });
            let i = 0;
            tabs.forEach((tab) => {
                const tabElement = document.createElement("div");
                tabElement.className = "tab";
                tabElement.textContent = tab.name.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                tabElement.id = `tab-index-${i}`;
                tabElement.addEventListener("click", () => {
                    setJSONData(i, jsonData, type);
                    tabElement.classList.add("active");
                    const otherTabs = document.querySelectorAll(".tab");
                    otherTabs.forEach((otherTab) => {
                        if (otherTab !== tabElement) {
                            otherTab.classList.remove("active");
                        }
                    });
                });
                tabScroller.appendChild(tabElement);
                i++;
            });
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
            subTabElement.innerHTML = `<a href="#${key}">${key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</a>`;
            subTabElement.addEventListener("click", () => {
                const contentElement = document.getElementById(key);
                if (contentElement) {
                    contentElement.scrollIntoView({ behavior: "smooth" });
                }
                subTabElement.classList.add("active");
                const otherSubTabs = document.querySelectorAll(".sub-tab");
                otherSubTabs.forEach((otherSubTab) => {
                    if (otherSubTab !== subTabElement) {
                        otherSubTab.classList.remove("active");
                    }
                });
            });
            subTabElement.id = `sub-tab-${key}`;
            subTabScroller.appendChild(subTabElement);
        }
    }
    for (const key in item) {
        if (item[key] !== "N/A" && item[key] !== "") {
            if (key === "read_to_the_youth" || key === "instructions" || key === "debrief" || key === "answer") {
                if (type === "sv") {
                    return;
                }
            }
            const contentElement = document.createElement("div");
            contentElement.className = "content";
            contentElement.id = key;
            contentElement.textContent = item[key];
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