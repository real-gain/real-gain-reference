# REAL GAIN Reference Implementation

[REAL GAIN (German Real Estate AI Initiative)](https://www.real-gain.com) is a network of companies in the real estate and facility management business aiming at offering a broad spectrum of tools to be used in Agentic AI systems to provide comprehensive data and functionality for the management of buildings, land and structures.

# Roles

The following roles exist in the REAL GAIN ecosystem

* **REAL GAIN Agent Providers** offer their Agentic AI Tools providing access to data and business logic via MCP servers. To become a REAL GAIN Agent provider read more [here](https://www.the-real-insight.com) and apply [here](https://www.the-real-insight.com).
* **REAL GAIN Solution Providers** add those tools flexibly to their solutions. To offer solutions through REAL GAIN, sign-up [here](https://www.the-real-insight.com).
* [The Real Insight GmbH](https://www.the-real-insight.com) serves as a **REAL Gain Platform Providers** offering a vast set of data from over 350 data sources and tools to interpret and visualize those data themselves and this way providing a **Multi-modal Chatbot** with orchestration of the selected tools to all solution providers.

Hereby, a special case may be very relevant: If you want to offer multimodal chatbot functionality in your company and also want to expose some existing internal data or services to it, you may become your own Agent provider and hook in you own Agents or standard agents provided by your database or groupware providers.

# Metering and Billing

Agent Providers can define a named user-based billing plan for the use of their tools - if selected by a Solution Provider. The Real Insight will meter the usage, invoice the solution providers and pay the Agent Provider.

# Reference Implementation

This reference implementation gives Agent Providers the boilerplate in Typescript and Python to implemented a REAL GAIN-compliant [MCP server](https://mcp.com), which can easily be registered and offered to Solution Providers on The Real Insight. The reference implementation implements two examples of Agent Tools

* a tool to suggest CO2-reduction measures for a building
* a tool to provide data about relevant real estate and facility management organisations in Germany

# Agent Tools

## Tool Definition

The main task of providing an MCP server is defining *Agent Tools* exposing capabilities to generate responses on a category of questions, such as in this reference implementation

```typescript
 server.tool(
        'co2measures',
        'Ein Werkzeug zur Ermittlung von technische Massnahmen, die die CO2-Emissionen in einem Gebäude zu reduzieren und helfen die Klimeziele für das Gebäude zu erreichen.',
        ...
```

or 

```typescript
server.tool(
        'realEstateOrganizations',
        'Ein Werkzeug zur Ermittlung von wichtigen Immobilien- und Facility Management-Organisationen in Deutschland.',
        ...
```

These tools will then be dynamically picked by the **Agent Orchestration** in **The Real Insight** to contribute to answers on user prompts.

## Tool Parameters

Agent Tools can define parameters which will be populated by the Agent Orchestration, e.g.

```typescript
 server.tool(
        'co2measures',
        'Ein Werkzeug zur Ermittlung von technische Massnahmen, die die CO2-Emissionen in einem Gebäude zu reduzieren und helfen die Klimeziele für das Gebäude zu erreichen.',
        {
            area: z.number().describe('Fläche des Gebäudes in Quadratmetern'),
        },
```

These parameters do not necessarily have to come from the user prompt. E.g. a tool may consume a list of technical assets in a building to return a list of necessary maintenance tasks or checks as part of the operator's responsibility. However the user may only have provided the address of a building and the Agent Orchestration may have first invoked a tool to retrieve the technical assets for that building and then pass it to mentioned tool.

## Tool Responses

The generation of responses against the input parameters happens in the tool implementation

```typescript
 server.tool(
        'co2measures',
        'Ein Werkzeug zur Ermittlung von technische Massnahmen, die die CO2-Emissionen in einem Gebäude zu reduzieren und helfen die Klimaziele für das Gebäude zu erreichen.',
        {
            area: z.number().describe('Fläche des Gebäudes in Quadratmetern'),
        },
        async ({ area }: { area: number }, { sendNotification }: { sendNotification: (notification: any) => Promise<void> }): Promise<CallToolResult> => {

        // Your implementation code goes here

        return {
                content: [{
                    type: 'text',
                    text: 'This is your response based on your implementation'
                }],
            };
        ));
```

Hereby, your application code can do anything from simple calculations to database or document queries and even invocations of other Agent Tools you have access to.

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

## Charts

A REAL GAIN chart configuration is an exact match to the JSON representation of an [APEX Chart](https://apexcharts.com) chart configuration, e.g.

```json
{
    "type": "chart", 
    "chart": {
        "type": "donut",
        "series": [12, 34, 166, 3],
        "options": {
            "chart": {
                "type: "donut",
            },
            "labels": ["Kleinstunternehmen", "Kleinunternehmen", "Mittlere Unternehmen", "Großunternehmen"],
            "title": {
                "text": "Unternehmensgrößen"
            },
        },
    }
}
```

## Maps

Map are used to display single locations or shapes and their data on a map.

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

### PoIs

Data provided in the **poi** section need to contain a **lat** and a **lon** field.

### Shapes

Data provided in the **shape** need to contain the geometry part of a [GeoJSON]() representation, that is

* a polygon
* a multi-polygon

e.g.

```json
````

or 

```json
```

### Legend

## Tables

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
                "name": "Name",
                "field": "name",
                "width": "200px",
                "align": "left"
            }, {
                "name": "Addresse",
                "field": "address",
                "width": "300px",
                "align": "left"
            }, {
                "name": "Beschreibung",
                "field": "description",
                "width": "400px",
                "align": "left"
            },
        ]
    },
}
```

## Resulting Agent Orchestration in The Real Insight

Once you have published a server compliant to the above concepts a customer who has subscribed to your server(s) and available tools will automatically see their use in their requests, e.g.

![Prompt1](doc/images/prompt1.png)

and

![Prompt2](doc/images/prompt2.jpeg)

# REAL GAIN-specific Information

We intend to keep the configuration efforts for enabling the use of your agents in *The Real Insight* as low as possible. Hence, the only activities required are 

* registering yourself as a customer in The Real Insight*
* Registering the server URL of your REAL GAIN-compliant server once

After that, all relevant changes can be initiated by redeploying your server.

## Billing Plans

A REAL GAIN-compliant server needs to implement a GET endpoint **real-gain/plans** to return the available named-user based billing plans for the use of the tools provided with the corresponding MCP server.

An example is provided in the reference implementation as follows

```typescript
app.get('/real-gain/plans', async (req: Request, res: Response) => {
    res.json([{
        id: 'base3',
        name: 'Basis 3 Nutzende',
        rank: 1,
        description: 'Monatliche Grundgebühr von 30€/Monat, abzuschließen für 1 Jahr und zahlbar bei Abschluss, 10€ für jeden registrierten Nutzenden ab dem 4. Nutzenden in monatlicher Abrechnung.',
        meterings: [{ type: 'numberOfNamedUsersMetering', name: 'Weitere registrierte Nutzende', amount: 10.0, offset: 3 }],
        baseFee: 30.0,
        term: 12,
        billingPeriod: 'monthly',
        creationDate: dayjs('2024-07-01 00:00').toDate(),
        validFromDate: dayjs('2024-07-01 00:00').toDate(),
    }, {
        id: 'base10',
        name: 'Basis 10 Nutzende',
        rank: 2,
        description: 'Monatliche Grundgebühr von 80€/Monat, abzuschließen für 1 Jahr und zahlbar bei Abschluss, 8€ für jeden registrierten Nutzenden ab dem 11. Nutzenden in monatlicher Abrechnung.',
        meterings: [{ type: 'numberOfNamedUsersMetering', name: 'Weitere registrierte Nutzende', amount: 8.0, offset: 10 }],
        baseFee: 80.0,
        term: 12,
        billingPeriod: 'monthly',
        creationDate: dayjs('2024-07-01 00:00').toDate(),
        validFromDate: dayjs('2024-07-01 00:00').toDate(),
    }, {
        id: 'base30',
        name: 'Basis 30 Nutzende',
        rank: 3,
        description: 'Monatliche Grundgebühr von 180€/Monat, abzuschließen für 1 Jahr und zahlbar bei Abschluss, 6€ für jeden registrierten Nutzenden ab dem 31. Nutzenden in monatlicher Abrechnung.',
        meterings: [{ type: 'numberOfNamedUsersMetering', name: 'Weitere registrierte Nutzende', amount: 6.0, offset: 30 }],
        baseFee: 180.0,
        term: 12,
        billingPeriod: 'monthly',
        creationDate: dayjs('2024-07-01 00:00').toDate(),
        validFromDate: dayjs('2024-07-01 00:00').toDate(),
    }, {
        id: 'base100',
        name: 'Basis 100 Nutzende',
        rank: 4,
        description: 'Monatliche Grundgebühr von 400€/Monat, abzuschließen für 1 Jahr und zahlbar bei Abschluss, 4€ für jeden registrierten Nutzenden ab dem 101. Nutzenden in monatlicher Abrechnung.',
        meterings: [{ type: 'numberOfNamedUsersMetering', name: 'Weitere registrierte Nutzende', amount: 4.0, offset: 100 }],
        baseFee: 400.0,
        term: 12,
        billingPeriod: 'monthly',
        creationDate: dayjs('2024-07-01 00:00').toDate(),
        validFromDate: dayjs('2024-07-01 00:00').toDate(),
    }]);
});
```

## General Info

# Test Clients

Both reference implementations provide a test client to immediately test the server implementation.

Alternatively, you can use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector).

# Security

# Typescript Details

The Typescript implementation provides a NodeJS/Express Server.

# Python Details


