# Ultimate Website

The Ultimate Website is a service that generates a complete website for a given idea.

## Technology Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Routing**: [FastAPI](https://fastapi.tiangolo.com/)
- **UI Components**: [SQLAdmin](https://sqladmin.readthedocs.io/en/latest/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [SQLAlchemy](https://www.sqlalchemy.org/)
- **LLM**: [Ollama](https://ollama.com/), [ComfyUI](https://comfy.ui/)

## Using the Service

In the idea detail page, there is a tab for "Ultimate Website". The tab contains three fields (Company Name, Industry, Target Audience) thar are required paramaters to call the service. When entering the values and clicking the "Generate" button, the service will generate a complete website for the given idea. All the processes are asynchronous and uses a queue system to manage the requests. When the job is completed, the user will be able to see the generated website in the "Ultimate Website" tab.
