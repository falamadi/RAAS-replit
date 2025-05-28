import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary');
    expect(button).not.toBeDisabled();
  });

  it('renders different variants correctly', () => {
    const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
    
    variants.forEach(variant => {
      const { rerender } = render(<Button variant={variant}>Button</Button>);
      const button = screen.getByRole('button');
      
      switch (variant) {
        case 'destructive':
          expect(button).toHaveClass('bg-destructive');
          break;
        case 'outline':
          expect(button).toHaveClass('border-input');
          break;
        case 'secondary':
          expect(button).toHaveClass('bg-secondary');
          break;
        case 'ghost':
          expect(button).toHaveClass('hover:bg-accent');
          break;
        case 'link':
          expect(button).toHaveClass('text-primary');
          break;
      }
      
      rerender(<div />); // Clean up between iterations
    });
  });

  it('renders different sizes correctly', () => {
    const sizes = ['default', 'sm', 'lg', 'icon'] as const;
    
    sizes.forEach(size => {
      const { rerender } = render(<Button size={size}>Button</Button>);
      const button = screen.getByRole('button');
      
      switch (size) {
        case 'sm':
          expect(button).toHaveClass('h-9');
          break;
        case 'lg':
          expect(button).toHaveClass('h-11');
          break;
        case 'icon':
          expect(button).toHaveClass('h-10 w-10');
          break;
        default:
          expect(button).toHaveClass('h-10');
      }
      
      rerender(<div />);
    });
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('prevents click when disabled', () => {
    const handleClick = jest.fn();
    render(<Button disabled onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders as a child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    
    const link = screen.getByRole('link', { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Button</Button>);
    const button = screen.getByRole('button');
    
    expect(button).toHaveClass('custom-class');
    expect(button).toHaveClass('inline-flex'); // Should still have base classes
  });

  it('shows loading state', () => {
    render(<Button loading>Loading Button</Button>);
    const button = screen.getByRole('button');
    
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Loading...');
  });

  it('renders with icons', () => {
    const Icon = () => <svg data-testid="icon" />;
    
    render(
      <Button>
        <Icon />
        With Icon
      </Button>
    );
    
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('With Icon')).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Button</Button>);
    
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.tagName).toBe('BUTTON');
  });

  it('handles form submission', () => {
    const handleSubmit = jest.fn(e => e.preventDefault());
    
    render(
      <form onSubmit={handleSubmit}>
        <Button type="submit">Submit</Button>
      </form>
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });
});