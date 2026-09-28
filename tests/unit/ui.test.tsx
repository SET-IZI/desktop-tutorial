import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Wordmark } from '@/components/ui/wordmark';

describe('Button', () => {
  it('est un bouton non-submit par défaut et appelle onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Commander</Button>);
    const btn = screen.getByRole('button', { name: 'Commander' });
    expect(btn).toHaveAttribute('type', 'button');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('se désactive pendant le chargement', () => {
    render(<Button loading>Payer</Button>);
    const btn = screen.getByRole('button', { name: 'Payer' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('rend un lien avec asChild', () => {
    render(
      <Button asChild>
        <a href="/menu">Voir le menu</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Voir le menu' })).toHaveClass('rounded-full');
  });
});

describe('Sheet', () => {
  it('s’ouvre avec un titre accessible et se ferme', async () => {
    render(
      <Sheet>
        <SheetTrigger>Ouvrir</SheetTrigger>
        <SheetContent title="Burger du chef">contenu</SheetContent>
      </Sheet>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    expect(await screen.findByRole('dialog', { name: 'Burger du chef' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Wordmark', () => {
  it('expose un nom accessible unique', () => {
    render(<Wordmark />);
    expect(screen.getByText('Miaamm')).toHaveClass('sr-only');
  });
});
