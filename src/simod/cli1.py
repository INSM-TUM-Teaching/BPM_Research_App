import sys
from pathlib import Path
import click

# This import will now work correctly if the command is run from the project root.
from simod.simod_resource import SimodResource

@click.command(help="Runs STAGE 2 (Resource) of the SIMOD pipeline.")
@click.argument(
    "resume_dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, resolve_path=True, path_type=Path),
)
def main(resume_dir: Path):
    """
    Resumes the pipeline and runs the resource discovery stage.
    """
    click.secho(">>> STAGE 2: Running Resource Discovery and Finalization", bold=True)
    click.echo(f"   -> Resuming pipeline from directory: {resume_dir}")

    # The check for 'control-flow' existence is good, let's keep it.
    if not (resume_dir / 'control-flow').exists():
        click.secho(f"Error: Invalid resume directory '{resume_dir}'. It must contain a 'control-flow' sub-directory.", fg='red')
        sys.exit(1)
        
    resource_stage = SimodResource(resume_dir=resume_dir)
    resource_stage.run()

    click.secho(f"\n✅ Full pipeline finished successfully!", fg='green')
    click.echo(f"   Final model and results are in: {resume_dir / 'best_result'}")

if __name__ == '__main__':
    main()