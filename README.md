# REAL GAIN Reference Implementation

[REAL GAIN (German Real Estate AI Initiative)](https://www.real-gain.com) is a network of companies in the real estate and facility management business aiming at offering a broad spectrum of tools to be used in Agentic AI systems to provide comprehensive data and functionality on management of buildings, land and structures.

# Roles

**REAL GAIN Agent Providers** offer their Agentic AI Tools providing access to data and business logic via MCP servers. To become a REAL GAIN Agent provider read more [here](https://www.the-real-insight.com) and apply [here](https://www.the-real-insight.com).

**REAL GAIN Solution Providers** add those tools flexibly to their solutions. To offer solutions through REAL GAIN, sign-up [here](https://www.the-real-insight.com).

[The Real Insight GmbH](https://www.the-real-insight.com) serves as a **REAL Gain Platform Providers** offering a vast set of data from over 350 data sources and tools to interpret and visualize those data themselves and this way providing a **Multi-modal Chatbot** with orchestration of the selected tools to all solution providers.

# Metering and Billing

Agent Providers can define a named user-based billing plan for the use of their tools - if selected by a Solution Provider. The Real Insight will meter the usage, invoice the solution providers and pay the Agent Provider.

# Reference Implementation

This reference implementation gives Agent Providers the boilerplate in Typescript and Python to implemented a REAL GAIN-compliant [MCP server](https://mcp.com), which can easily be registered and offered to Solution Providers on The Real Insight.

# Multi-modal Responses

In addition to standard MCP responses, REAL GAIN supports a specific set of resource types allowing for multi-modal responses from REAL GAIN Agent Tools:

* **Charts**
* **Maps**
* **Tables**
* **Reports**

The data and configurations of such a resource have to be base64-encoded into the *blob* field of the MCP resource, e.g.

```typescript
realGainResource = {
    type: 'chart',
    options: {...}
}

resource.blob = Buffer.from(JSON.stringify(chartResource)).toString('base64')
```

# Charts

A REAL GAIN chart configuration is an exact match to the JSON representation of an [APEX Chart](https://apexcharts.com) chart configuration, e.g.

```json
```

# Maps

```json
{
    "type": 'mapAndImage',
    "title": `Wichtige Immobilien- und Facility Management-Organisationen in Deutschland`,
    "options": {
        "entityType": 'PoI',
        "bounds": [[5.866667, 47.270111], [15.041667, 55.055556]],
        "zoom": 6,
    },
    "data": [...],
}
```

There are two flavors of the map **type**, *map* and *mapAndImage*. The latter renders a map which allows to switch to a satellite image.

![Map and Image Visualization](doc/images/mapAndImage.png)

## PoIs

Data provided in the **poi** section need to contain a **lat** and a **lon** field.

## Shapes

Data provided in the **shape** need to contain the geometry part of a [GeoJSON]() representation, that is

* a polygon
* a multi-polygon

e.g.

```json
````

or 

```json
```

## Legend

# Tables

A JSON table specification contains a **data** and and **options** section as follows

```json
{
    "data": [...],
    "options": {...}
}
```

The data section just contains the records to be displayed in the table, e.g.

```json
{
    "data": [{
        "name": "Schmitz Photovoltaik GmbH",
        "address": "Gansheimer Weg 22, 89089 Seck",
        "description": "Installation und Wartung von PV-Anlagen"
    }, ...],
}
```

The options section contains title and column specifications as follows

```json
{
    "options": {
        "title": "",
        "columns": [
            {
                "name": "",
                "width": "200px",
                "align": "left"
            },
        ]
    },
}
```

# Agent Orchestration in The Real Insight

Once you have published a server compliant to the above concepts a customer who has subscribed to your server(s) and available tools will automatically see their use in their requests, e.g.

![Prompt1](doc/images/prompt1.png)

and

![Prompt2](doc/images/prompt2.png)

# Billing Plans

A REAL GAIN-compliant server needs to implement a GET endpoint **real-gain/plans** to return the available named-user based billing plans for the use of the tools provided with the corresponding MCP server.

# General Info

## Test Clients

Both reference implementations provide a test client to immediately test the server implementation.

Alternatively, you can use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector).

# Security

## Typescript Details

## Python Details


